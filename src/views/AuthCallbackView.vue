<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ensureAuthenticated, handleCallback } from '../auth/authStore'

const route = useRoute()
const router = useRouter()
const errorMessage = ref<string | null>(null)

onMounted(async () => {
  if (await ensureAuthenticated()) {
    await router.replace({ name: 'home' })
    return
  }

  const oauthError = route.query.error
  if (typeof oauthError === 'string' && oauthError.length > 0) {
    const description = route.query.error_description
    errorMessage.value =
      typeof description === 'string' && description.length > 0 ? description : oauthError
    return
  }

  const code = route.query.code
  const state = route.query.state
  if (typeof code !== 'string' || typeof state !== 'string') {
    errorMessage.value = 'Missing authorization code from Munero Connect.'
    return
  }

  try {
    await handleCallback(code, state)
    await router.replace({ name: 'home' })
  } catch (error) {
    if (await ensureAuthenticated()) {
      await router.replace({ name: 'home' })
      return
    }
    errorMessage.value = error instanceof Error ? error.message : 'Sign-in failed.'
  }
})
</script>

<template>
  <main class="callback">
    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    <p v-else>Signing you in…</p>
  </main>
</template>

<style scoped>
.callback {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  text-align: center;
}

.error {
  max-width: 32rem;
  color: #8a1f1f;
  line-height: 1.5;
}
</style>
