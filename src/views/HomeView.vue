<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { accessClaims, authorizationHeader, getAccessToken, logout, user } from '../auth/authStore'
import {
  fetchAndStorePrivileges,
  getPrivilege,
  hasAllPrivileges,
  hasAnyPrivilege,
  hasPrivilege,
  listPrivilegesByType,
  onPrivilegesChanged,
  privilegeAppUrl,
  privileges,
} from '../auth/privileges'

const checkStatus = ref<'idle' | 'loading' | 'valid' | 'invalid'>('idle')
const checkDetail = ref('')
const privilegesRefreshing = ref(false)
const testIdentifier = ref('GIFTLOV')
const testIdentifierB = ref('PXM')
const testTypeId = ref('APP')
const lastPrivilegeEvent = ref('none yet (same list does not emit)')

const helperResults = computed(() => {
  void privileges.value
  const a = testIdentifier.value.trim()
  const b = testIdentifierB.value.trim()
  const ids = [a, b].filter(Boolean)
  const typeId = testTypeId.value.trim()
  return {
    hasPrivilege: a ? hasPrivilege(a) : false,
    hasAnyPrivilege: ids.length > 0 ? hasAnyPrivilege(...ids) : false,
    hasAllPrivileges: ids.length > 0 ? hasAllPrivileges(...ids) : false,
    getPrivilege: a ? (getPrivilege(a) ?? null) : null,
    listPrivilegesByType: typeId
      ? listPrivilegesByType(typeId).map((item) => item.privilegeIdentifier)
      : [],
    privilegeAppUrl: a ? (privilegeAppUrl(a) ?? null) : null,
  }
})

const primaryFields = computed(() => {
  const profile = user.value
  if (!profile) {
    return []
  }

  return [
    { label: 'Name', value: profile.name },
    { label: 'Email', value: profile.email },
    { label: 'Given name', value: profile.givenName },
    { label: 'Family name', value: profile.familyName },
    { label: 'Username', value: profile.username },
    { label: 'Subject', value: profile.sub },
  ].filter((field) => field.value)
})

const authzFields = computed(() => {
  const claims = accessClaims.value
  if (!claims) {
    return []
  }

  return [
    { label: 'roles', value: formatClaim(claims.roles) },
    { label: 'groups', value: formatClaim(claims.groups) },
    { label: 'custom:ext_user_roles', value: formatClaim(claims.extUserRoles) },
    { label: 'custom:ext_user_groups', value: formatClaim(claims.extUserGroups) },
  ].filter((field) => field.value !== '[]' && field.value !== '')
})

const idClaimRows = computed(() => claimRows(user.value?.claims ?? {}))
const accessClaimRows = computed(() => claimRows(accessClaims.value?.claims ?? {}))

function claimRows(claims: Record<string, unknown>) {
  return Object.entries(claims)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({
      key,
      value: formatClaim(value),
    }))
}

function formatClaim(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return JSON.stringify(value)
}

async function checkToken(): Promise<void> {
  checkStatus.value = 'loading'
  checkDetail.value = ''

  const apiBase = import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '')
  try {
    const response = await fetch(`${apiBase}/checktoken`, {
      headers: await authorizationHeader(),
    })
    const body = await response.json().catch(() => null)
    if (response.ok && body && body.valid === true) {
      checkStatus.value = 'valid'
      checkDetail.value = JSON.stringify(body, null, 2)
      return
    }
    checkStatus.value = 'invalid'
    checkDetail.value = JSON.stringify(body ?? { status: response.status }, null, 2)
  } catch (error) {
    checkStatus.value = 'invalid'
    checkDetail.value = error instanceof Error ? error.message : 'Request failed'
  }
}

async function refreshPrivileges(): Promise<void> {
  privilegesRefreshing.value = true
  try {
    await fetchAndStorePrivileges(await getAccessToken(), { failOpen: false })
  } finally {
    privilegesRefreshing.value = false
  }
}

onMounted(() => {
  const stop = onPrivilegesChanged((items) => {
    lastPrivilegeEvent.value = `${new Date().toISOString()} — ${items.length} item(s)`
  })
  onUnmounted(stop)
})
</script>

<template>
  <main class="home">
    <header class="header">
      <div>
        <p class="eyebrow">Munero Hub</p>
        <h1>Signed in</h1>
      </div>
      <button type="button" class="sign-out" @click="logout">Sign out</button>
    </header>

    <section v-if="primaryFields.length" class="card">
      <h2>Primary details</h2>
      <dl>
        <template v-for="field in primaryFields" :key="field.label">
          <dt>{{ field.label }}</dt>
          <dd>{{ field.value }}</dd>
        </template>
      </dl>
    </section>

    <section class="card">
      <h2>Access token authorization</h2>
      <p class="hint">Use this access token as <code>Authorization: Bearer</code> for API calls — not the ID token.</p>
      <dl v-if="authzFields.length">
        <template v-for="field in authzFields" :key="field.label">
          <dt>{{ field.label }}</dt>
          <dd>{{ field.value }}</dd>
        </template>
      </dl>
      <p v-else class="hint">No roles or groups claims on this access token.</p>
      <button type="button" class="sign-out check-token" :disabled="checkStatus === 'loading'" @click="checkToken">
        {{ checkStatus === 'loading' ? 'Checking…' : 'Check Token' }}
      </button>
      <p v-if="checkStatus === 'valid'" class="check-ok">Token is valid</p>
      <p v-if="checkStatus === 'invalid'" class="check-bad">Token is not valid</p>
      <pre v-if="checkDetail" class="check-detail">{{ checkDetail }}</pre>
    </section>

    <section class="card">
      <h2>Privileges</h2>
      <p class="hint">MuneroHub apps assigned through this user’s roles, groups, and user assignment. Loaded at sign-in and stored locally.</p>
      <ul v-if="privileges.length" class="privilege-list">
        <li v-for="item in privileges" :key="item.privilegeIdentifier || item.privilegeName" v-show="!item.privilegeIdentifier || hasPrivilege(item.privilegeIdentifier)">
          <a v-if="item.metadata?.url" :href="item.metadata.url" target="_blank" rel="noreferrer">
            {{ item.privilegeName }}
          </a>
          <strong v-else>{{ item.privilegeName }}</strong>
          <span v-if="item.description" class="privilege-desc">{{ item.description }}</span>
        </li>
      </ul>
      <p v-else class="hint privileges-empty">No MuneroHub privileges.</p>
      <button type="button" class="sign-out check-token" :disabled="privilegesRefreshing" @click="refreshPrivileges">
        {{ privilegesRefreshing ? 'Refreshing…' : 'Refresh privileges' }}
      </button>
    </section>

    <section class="card">
      <h2>Privilege helper tester</h2>
      <p class="hint">
        Try the helpers from
        <code>src/auth/privileges.ts</code>. Change ids and refresh privileges to see live results.
        <code>onPrivilegesChanged</code> only updates when the list actually changes.
      </p>
      <div class="helper-fields">
        <label>
          Identifier A
          <input v-model="testIdentifier" type="text" autocomplete="off" />
        </label>
        <label>
          Identifier B
          <input v-model="testIdentifierB" type="text" autocomplete="off" />
        </label>
        <label>
          Type id
          <input v-model="testTypeId" type="text" autocomplete="off" />
        </label>
      </div>
      <dl class="helper-results">
        <dt>hasPrivilege(A)</dt>
        <dd>{{ helperResults.hasPrivilege }}</dd>
        <dt>hasAnyPrivilege(A, B)</dt>
        <dd>{{ helperResults.hasAnyPrivilege }}</dd>
        <dt>hasAllPrivileges(A, B)</dt>
        <dd>{{ helperResults.hasAllPrivileges }}</dd>
        <dt>privilegeAppUrl(A)</dt>
        <dd>{{ helperResults.privilegeAppUrl || 'undefined' }}</dd>
        <dt>listPrivilegesByType(type)</dt>
        <dd>{{ helperResults.listPrivilegesByType.join(', ') || '(none)' }}</dd>
        <dt>onPrivilegesChanged</dt>
        <dd>{{ lastPrivilegeEvent }}</dd>
      </dl>
      <p class="hint">getPrivilege(A)</p>
      <pre class="check-detail">{{ JSON.stringify(helperResults.getPrivilege, null, 2) }}</pre>
    </section>

    <section class="card">
      <h2>Access token claims</h2>
      <dl>
        <template v-for="row in accessClaimRows" :key="row.key">
          <dt>{{ row.key }}</dt>
          <dd>{{ row.value }}</dd>
        </template>
      </dl>
    </section>

    <section class="card">
      <h2>ID token claims</h2>
      <dl>
        <template v-for="row in idClaimRows" :key="row.key">
          <dt>{{ row.key }}</dt>
          <dd>{{ row.value }}</dd>
        </template>
      </dl>
    </section>
  </main>
</template>

<style scoped>
.home {
  max-width: 44rem;
  margin: 0 auto;
  padding: 2.5rem 1.5rem 3rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.eyebrow {
  margin: 0 0 0.25rem;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #5c6570;
}

h1 {
  margin: 0;
  font-size: clamp(1.75rem, 4vw, 2.25rem);
  font-weight: 650;
  letter-spacing: -0.02em;
}

h2 {
  margin: 0 0 1rem;
  font-size: 0.95rem;
  font-weight: 650;
}

.hint {
  margin: 0 0 1rem;
  color: #5c6570;
  font-size: 0.9rem;
  line-height: 1.45;
}

.hint code {
  font-size: 0.85em;
}

.sign-out {
  appearance: none;
  border: 1px solid #cfd6dd;
  background: #fff;
  color: inherit;
  border-radius: 0.5rem;
  padding: 0.5rem 0.9rem;
  font: inherit;
  cursor: pointer;
}

.sign-out:hover {
  background: #eef1f4;
}

.sign-out:disabled {
  opacity: 0.6;
  cursor: wait;
}

.check-token {
  margin-top: 1rem;
}

.check-ok {
  margin: 0.85rem 0 0;
  color: #1b6b3a;
  font-weight: 600;
}

.check-bad {
  margin: 0.85rem 0 0;
  color: #8a1f1f;
  font-weight: 600;
}

.check-detail {
  margin: 0.65rem 0 0;
  padding: 0.75rem 0.85rem;
  overflow-x: auto;
  font-size: 0.8rem;
  line-height: 1.4;
  background: #f3f5f7;
  border-radius: 0.5rem;
}

.privileges-empty {
  margin-top: 0.85rem;
}

.helper-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: 0.75rem 1rem;
  margin: 0 0 1rem;
}

.helper-fields label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.8rem;
  color: #5c6570;
}

.helper-fields input {
  appearance: none;
  border: 1px solid #cfd6dd;
  border-radius: 0.5rem;
  padding: 0.45rem 0.65rem;
  font: inherit;
  color: inherit;
}

.helper-results {
  margin-bottom: 0.85rem;
}

.privilege-list {
  margin: 0.85rem 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.privilege-list li {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.privilege-list a {
  color: inherit;
  font-weight: 650;
}

.privilege-desc {
  color: #5c6570;
  font-size: 0.9rem;
}

.card {
  background: #fff;
  border: 1px solid #e3e8ed;
  border-radius: 0.75rem;
  padding: 1.25rem 1.35rem;
}

dl {
  margin: 0;
  display: grid;
  grid-template-columns: minmax(8rem, 11rem) 1fr;
  gap: 0.55rem 1rem;
}

dt {
  margin: 0;
  color: #5c6570;
  font-size: 0.85rem;
}

dd {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: 0.95rem;
}

@media (max-width: 640px) {
  dl {
    grid-template-columns: 1fr;
    gap: 0.15rem;
  }

  dt + dd {
    margin-bottom: 0.65rem;
  }
}
</style>
