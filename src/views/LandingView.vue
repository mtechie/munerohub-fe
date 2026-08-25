<script setup lang="ts">
</script>

<template>
  <main class="landing">
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
  padding: 0.65rem 1.1rem;
  font: inherit;
  text-decoration: none;
  cursor: pointer;
}

.login:hover {
  background: #eef1f4;
}
</style>
