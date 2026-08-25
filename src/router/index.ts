import { createRouter, createWebHistory } from 'vue-router'
import { ensureAuthenticated, login } from '../auth/authStore'
import HomeView from '../views/HomeView.vue'
import AuthCallbackView from '../views/AuthCallbackView.vue'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { requiresAuth: true },
    },
    {
      path: '/auth/callback',
      name: 'auth-callback',
      component: AuthCallbackView,
    },
  ],
})

router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) {
    return true
  }

  if (await ensureAuthenticated()) {
    return true
  }

  await login()
  return false
})

export default router
