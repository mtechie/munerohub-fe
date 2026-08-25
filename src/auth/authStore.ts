import { computed, reactive } from 'vue'
import { cognitoConfig } from './config'

const TOKEN_KEYS = {
  accessToken: 'munero.hub.access_token',
  idToken: 'munero.hub.id_token',
  refreshToken: 'munero.hub.refresh_token',
  expiresAt: 'munero.hub.expires_at',
} as const

const OAUTH_KEYS = {
  pkceVerifier: 'munero.hub.pkce_verifier',
  oauthState: 'munero.hub.oauth_state',
} as const

const EXPIRY_SKEW_MS = 30_000
const PKCE_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'

export interface UserProfile {
  sub: string | null
  email: string | null
  name: string | null
  givenName: string | null
  familyName: string | null
  username: string | null
  claims: Record<string, unknown>
}

export interface AccessClaims {
  roles: string[]
  groups: string[]
  extUserRoles: string[]
  extUserGroups: string[]
  claims: Record<string, unknown>
}

interface AuthState {
  accessToken: string | null
  idToken: string | null
  refreshToken: string | null
  expiresAt: number | null
  user: UserProfile | null
  accessClaims: AccessClaims | null
}

interface TokenEndpointPayload {
  access_token?: string
  id_token?: string
  refresh_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

const state = reactive<AuthState>({
  accessToken: null,
  idToken: null,
  refreshToken: null,
  expiresAt: null,
  user: null,
  accessClaims: null,
})

let refreshInFlight: Promise<boolean> | null = null

export const isAuthenticated = computed(() => {
  return (
    typeof state.accessToken === 'string' &&
    state.accessToken.length > 0 &&
    typeof state.expiresAt === 'number' &&
    state.expiresAt > Date.now()
  )
})

export const user = computed(() => state.user)
export const accessClaims = computed(() => state.accessClaims)

function readStorage(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string): void {
  sessionStorage.setItem(key, value)
}

function removeStorage(key: string): void {
  sessionStorage.removeItem(key)
}

function randomString(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (byte) => PKCE_CHARSET[byte % PKCE_CHARSET.length]).join('')
}

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64UrlEncode(digest)
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.')
  if (parts.length !== 3 || !parts[1]) {
    throw new Error('Invalid JWT')
  }

  const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/')
  const remainder = padded.length % 4
  const base64 = remainder === 0 ? padded : padded + '='.repeat(4 - remainder)
  return JSON.parse(atob(base64)) as Record<string, unknown>
}

function claimString(claims: Record<string, unknown>, key: string): string | null {
  const value = claims[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
  }
  if (typeof value === 'string' && value.length > 0) {
    return value.split(/[,\s]+/).filter(Boolean)
  }
  return []
}

function profileFromIdToken(idToken: string): UserProfile {
  const claims = decodeJwtPayload(idToken)
  return {
    sub: claimString(claims, 'sub'),
    email: claimString(claims, 'email'),
    name: claimString(claims, 'name'),
    givenName: claimString(claims, 'given_name'),
    familyName: claimString(claims, 'family_name'),
    username: claimString(claims, 'cognito:username') ?? claimString(claims, 'username'),
    claims,
  }
}

function claimsFromAccessToken(accessToken: string): AccessClaims {
  const claims = decodeJwtPayload(accessToken)
  return {
    roles: asStringArray(claims.roles),
    groups: asStringArray(claims.groups),
    extUserRoles: asStringArray(claims['custom:ext_user_roles']),
    extUserGroups: asStringArray(claims['custom:ext_user_groups']),
    claims,
  }
}

function clearTokens(): void {
  state.accessToken = null
  state.idToken = null
  state.refreshToken = null
  state.expiresAt = null
  state.user = null
  state.accessClaims = null

  for (const key of Object.values(TOKEN_KEYS)) {
    removeStorage(key)
  }
}

function clearOAuth(): void {
  for (const key of Object.values(OAUTH_KEYS)) {
    removeStorage(key)
  }
}

function persistTokens(tokens: {
  accessToken: string
  idToken: string
  expiresAt: number
  refreshToken?: string | null
}): void {
  state.accessToken = tokens.accessToken
  state.idToken = tokens.idToken
  state.expiresAt = tokens.expiresAt
  state.user = profileFromIdToken(tokens.idToken)
  state.accessClaims = claimsFromAccessToken(tokens.accessToken)

  writeStorage(TOKEN_KEYS.accessToken, tokens.accessToken)
  writeStorage(TOKEN_KEYS.idToken, tokens.idToken)
  writeStorage(TOKEN_KEYS.expiresAt, String(tokens.expiresAt))

  if (tokens.refreshToken === undefined) {
    return
  }

  if (tokens.refreshToken) {
    state.refreshToken = tokens.refreshToken
    writeStorage(TOKEN_KEYS.refreshToken, tokens.refreshToken)
    return
  }

  state.refreshToken = null
  removeStorage(TOKEN_KEYS.refreshToken)
}

async function postToken(body: URLSearchParams): Promise<{ ok: boolean; payload: TokenEndpointPayload }> {
  const response = await fetch(`${cognitoConfig.domain}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  let payload: TokenEndpointPayload = {}
  try {
    payload = (await response.json()) as TokenEndpointPayload
  } catch {
    payload = {}
  }

  return { ok: response.ok, payload }
}

async function refreshTokens(): Promise<boolean> {
  if (refreshInFlight) {
    return refreshInFlight
  }

  refreshInFlight = (async () => {
    const currentRefresh = state.refreshToken
    if (!currentRefresh) {
      clearTokens()
      return false
    }

    const { ok, payload } = await postToken(
      new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: cognitoConfig.clientId,
        refresh_token: currentRefresh,
      }),
    )

    const idToken = payload.id_token ?? state.idToken
    if (!ok || !payload.access_token || !idToken) {
      clearTokens()
      return false
    }

    persistTokens({
      accessToken: payload.access_token,
      idToken,
      expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000 - EXPIRY_SKEW_MS,
      refreshToken: payload.refresh_token,
    })
    return true
  })().finally(() => {
    refreshInFlight = null
  })

  return refreshInFlight
}

export function hydrate(): void {
  const accessToken = readStorage(TOKEN_KEYS.accessToken)
  const idToken = readStorage(TOKEN_KEYS.idToken)
  const refreshToken = readStorage(TOKEN_KEYS.refreshToken)
  const expiresAtRaw = readStorage(TOKEN_KEYS.expiresAt)
  const expiresAt = expiresAtRaw ? Number(expiresAtRaw) : NaN

  if (!refreshToken && (!accessToken || !idToken || !Number.isFinite(expiresAt) || expiresAt <= Date.now())) {
    clearTokens()
    return
  }

  state.accessToken = accessToken
  state.idToken = idToken
  state.refreshToken = refreshToken
  state.expiresAt = Number.isFinite(expiresAt) ? expiresAt : null

  try {
    if (idToken) {
      state.user = profileFromIdToken(idToken)
    }
    if (accessToken) {
      state.accessClaims = claimsFromAccessToken(accessToken)
    }
  } catch {
    clearTokens()
  }
}

export async function ensureAuthenticated(): Promise<boolean> {
  if (isAuthenticated.value) {
    return true
  }
  if (state.refreshToken) {
    return refreshTokens()
  }
  clearTokens()
  return false
}

export async function getAccessToken(): Promise<string | null> {
  if (await ensureAuthenticated()) {
    return state.accessToken
  }
  return null
}

export async function authorizationHeader(): Promise<{ Authorization: string } | Record<string, never>> {
  const accessToken = await getAccessToken()
  if (!accessToken) {
    return {}
  }
  return { Authorization: `Bearer ${accessToken}` }
}

export async function login(): Promise<void> {
  const verifier = randomString(64)
  const stateValue = randomString(32)
  writeStorage(OAUTH_KEYS.pkceVerifier, verifier)
  writeStorage(OAUTH_KEYS.oauthState, stateValue)

  const params = new URLSearchParams({
    client_id: cognitoConfig.clientId,
    response_type: 'code',
    scope: cognitoConfig.scopes,
    redirect_uri: cognitoConfig.redirectUri,
    identity_provider: cognitoConfig.identityProvider,
    state: stateValue,
    code_challenge: await codeChallenge(verifier),
    code_challenge_method: 'S256',
  })

  window.location.assign(`${cognitoConfig.domain}/oauth2/authorize?${params.toString()}`)
}

export async function handleCallback(code: string, returnedState: string): Promise<void> {
  const expectedState = readStorage(OAUTH_KEYS.oauthState)
  const verifier = readStorage(OAUTH_KEYS.pkceVerifier)
  removeStorage(OAUTH_KEYS.oauthState)
  removeStorage(OAUTH_KEYS.pkceVerifier)

  if (!expectedState || expectedState !== returnedState) {
    throw new Error('Sign-in state mismatch. Please try again.')
  }
  if (!verifier) {
    throw new Error('Missing PKCE verifier. Please try again.')
  }

  const { ok, payload } = await postToken(
    new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: cognitoConfig.clientId,
      code,
      redirect_uri: cognitoConfig.redirectUri,
      code_verifier: verifier,
    }),
  )

  if (!ok || !payload.access_token || !payload.id_token) {
    throw new Error(payload.error_description || payload.error || 'Token exchange failed')
  }

  persistTokens({
    accessToken: payload.access_token,
    idToken: payload.id_token,
    refreshToken: payload.refresh_token ?? null,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000 - EXPIRY_SKEW_MS,
  })
}

export async function logout(): Promise<void> {
  const refreshToken = state.refreshToken
  if (refreshToken) {
    try {
      await fetch(`${cognitoConfig.domain}/oauth2/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          token: refreshToken,
          client_id: cognitoConfig.clientId,
          token_type_hint: 'refresh_token',
        }),
      })
    } catch {
      // Local sign-out still proceeds if revoke is unreachable.
    }
  }

  clearTokens()
  clearOAuth()
  const logoutUri = `${window.location.origin}/landing`
  const params = new URLSearchParams({
    client_id: cognitoConfig.clientId,
    logout_uri: logoutUri,
  })
  window.location.assign(`${cognitoConfig.domain}/logout?${params.toString()}`)
}

hydrate()
