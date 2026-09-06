<script setup lang="ts">
</script>

<template>
  <main class="landing">
    <img class="brand-mark" src="/favicon.png" alt="" />
    <h1>Welcome to Munero Hub</h1>
    <RouterLink class="login" to="/">Click here to Log In</RouterLink>
  </main>
</template>

<style scoped>
.landing {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.25rem;
  padding: 1.5rem;
  text-align: center;
}

.brand-mark {
  width: 4.5rem;
  height: 4.5rem;
  object-fit: contain;
}

h1 {
  margin: 0;
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  font-weight: 650;
  letter-spacing: -0.02em;
}

.login {
  appearance: none;
  display: inline-block;
  border: 1px solid #cfd6dd;
  background: #fff;
  color: inherit;
  border-radius: 0.5rem;
  min-height: 2.75rem;
  padding: 0.65rem 1.1rem;
  font: inherit;
  text-decoration: none;
  cursor: pointer;
  touch-action: manipulation;
}

.login:hover {
  background: #eef1f4;
}
</style>
