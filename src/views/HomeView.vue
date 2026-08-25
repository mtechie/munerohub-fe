<script setup lang="ts">
import { computed } from 'vue'
import { logout, user } from '../auth/authStore'

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

const claimRows = computed(() => {
  const claims = user.value?.claims ?? {}
  return Object.entries(claims)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({
      key,
      value: formatClaim(value),
    }))
})

function formatClaim(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return JSON.stringify(value)
}
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
      <h2>ID token claims</h2>
      <dl>
        <template v-for="row in claimRows" :key="row.key">
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
