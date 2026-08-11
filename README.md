# Munero Hub (Frontend)

Vue 3 frontend for Munero Hub — a portal for Munero services. Design and Cognito SSO come later; this repo boots the app and Amplify hosting.

## Stack

- Vue 3 + Vite + TypeScript + Vue Router
- npm
- AWS Amplify Hosting (GitHub-connected deploy via `amplify.yml`)

## Local development

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run type-check
npm run build
npm run preview
```

## Amplify + GitHub setup

1. Create a GitHub repository (e.g. `munerohub-fe`) and push the `main` branch.
2. In **AWS Amplify Console** → **Hosting** → **Host web app** → connect **GitHub**.
3. Select this repository and branch `main`. Amplify should pick up root [`amplify.yml`](amplify.yml).
4. Add an SPA rewrite so Vue Router deep links work:
   - Source: `</^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webp)$)([^.]+$)/>`
   - Target: `/index.html`
   - Type: `200` (rewrite)
5. Save and deploy. Confirm the Amplify URL shows the temporary hello page.

Deploy is handled by Amplify on push to `main`. GitHub Actions CI only type-checks and builds (no AWS credentials required).

## Temporary hello page

[`src/views/HelloView.vue`](src/views/HelloView.vue) is a placeholder and will be removed when real hub UI arrives.
