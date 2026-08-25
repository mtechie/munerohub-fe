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

interface AuthState {
  accessToken: string | null
  idToken: string | null
  refreshToken: string | null
  expiresAt: number | null
  user: UserProfile | null
}

const state = reactive<AuthState>({
  accessToken: null,
  idToken: null,
  refreshToken: null,
  expiresAt: null,
  user: null,
})

export const isAuthenticated = computed(() => {
  return (
    typeof state.accessToken === 'string' &&
    state.accessToken.length > 0 &&
    typeof state.expiresAt === 'number' &&
    state.expiresAt > Date.now()
  )
})

export const user = computed(() => state.user)

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

function clearTokens(): void {
  state.accessToken = null
  state.idToken = null
  state.refreshToken = null
  state.expiresAt = null
  state.user = null

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
  refreshToken: string | null
  expiresAt: number
}): void {
  state.accessToken = tokens.accessToken
  state.idToken = tokens.idToken
  state.refreshToken = tokens.refreshToken
  state.expiresAt = tokens.expiresAt
  state.user = profileFromIdToken(tokens.idToken)

  writeStorage(TOKEN_KEYS.accessToken, tokens.accessToken)
  writeStorage(TOKEN_KEYS.idToken, tokens.idToken)
  writeStorage(TOKEN_KEYS.expiresAt, String(tokens.expiresAt))
  if (tokens.refreshToken) {
    writeStorage(TOKEN_KEYS.refreshToken, tokens.refreshToken)
  } else {
    removeStorage(TOKEN_KEYS.refreshToken)
  }
}

export function hydrate(): void {
  const accessToken = readStorage(TOKEN_KEYS.accessToken)
  const idToken = readStorage(TOKEN_KEYS.idToken)
  const refreshToken = readStorage(TOKEN_KEYS.refreshToken)
  const expiresAtRaw = readStorage(TOKEN_KEYS.expiresAt)
  const expiresAt = expiresAtRaw ? Number(expiresAtRaw) : NaN

  if (!accessToken || !idToken || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    clearTokens()
    return
  }

  try {
    persistTokens({
      accessToken,
      idToken,
      refreshToken,
      expiresAt,
    })
  } catch {
    clearTokens()
  }
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

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: cognitoConfig.clientId,
    code,
    redirect_uri: cognitoConfig.redirectUri,
    code_verifier: verifier,
  })

  const response = await fetch(`${cognitoConfig.domain}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const payload = (await response.json()) as {
    access_token?: string
    id_token?: string
    refresh_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }

  if (!response.ok || !payload.access_token || !payload.id_token) {
    throw new Error(payload.error_description || payload.error || 'Token exchange failed')
  }

  const expiresInMs = (payload.expires_in ?? 3600) * 1000
  persistTokens({
    accessToken: payload.access_token,
    idToken: payload.id_token,
    refreshToken: payload.refresh_token ?? null,
    expiresAt: Date.now() + expiresInMs - EXPIRY_SKEW_MS,
  })
}

export function logout(): void {
  clearTokens()
  clearOAuth()
  const logoutUri = `${window.location.origin}/`
  const params = new URLSearchParams({
    client_id: cognitoConfig.clientId,
    logout_uri: logoutUri,
  })
  window.location.assign(`${cognitoConfig.domain}/logout?${params.toString()}`)
}

hydrate()
