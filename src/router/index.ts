import { createRouter, createWebHistory } from 'vue-router'
import { ensureAuthenticated, login, setAuthBusy } from '../auth/authStore'
import HomeView from '../views/HomeView.vue'
import LaunchpadView from '../views/LaunchpadView.vue'
import LandingView from '../views/LandingView.vue'
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
      component: LaunchpadView,
      meta: { requiresAuth: true },
    },
    {
      path: '/debug',
      name: 'debug',
      component: HomeView,
      meta: { requiresAuth: true },
    },
    {
      path: '/landing',
      name: 'landing',
      component: LandingView,
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

  setAuthBusy('Signing in…', { sticky: true })
  await login()
  return false
})

export default router
