<script setup lang="ts">
import { authBusy, authBusyMessage } from './auth/authStore'
</script>

<template>
  <RouterView />
  <div
    v-if="authBusy"
    class="auth-busy"
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <div class="auth-busy-card">
      <span class="auth-busy-spinner" aria-hidden="true"></span>
      <p>{{ authBusyMessage || 'Loading…' }}</p>
    </div>
  </div>
</template>

<style scoped>
.auth-busy {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgb(26 31 38 / 45%);
  pointer-events: auto;
}

.auth-busy-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.85rem;
  width: min(18rem, 100%);
  padding: 1.4rem 1.35rem 1.25rem;
  background: #fff;
  border-radius: 0.95rem;
  box-shadow: 0 12px 40px rgb(26 31 38 / 16%);
  text-align: center;
}

.auth-busy-card p {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 650;
}

.auth-busy-spinner {
  width: 1.85rem;
  height: 1.85rem;
  border: 0.2rem solid #e7ecf1;
  border-top-color: #f47b20;
  border-radius: 999px;
  animation: auth-busy-spin 0.7s linear infinite;
}

@keyframes auth-busy-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
