import { createRouter, createWebHistory } from 'vue-router'
import HelloView from '../views/HelloView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'hello',
      component: HelloView,
    },
  ],
})

export default router
