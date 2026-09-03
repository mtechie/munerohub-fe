# Munero Hub (Frontend)

Vue 3 frontend for Munero Hub — a portal for Munero services. Unauthenticated visitors are redirected to Munero Connect (Amazon Cognito federated through Microsoft 365).

Privilege-based show/hide helpers: [docs/privileges.md](docs/privileges.md).

## Stack

- Vue 3 + Vite + TypeScript + Vue Router
- npm
- AWS Amplify Hosting (GitHub-connected deploy via `amplify.yml`)
- Amazon Cognito hosted UI (`hublogin.munero.net`) with identity provider `MGL-MS-IDP`

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

Local OAuth callback: `http://localhost:5173/auth/callback` (see `.env.development`). Copy [`.env.example`](.env.example) only if you need a personal override in `.env.local`.

## Cognito app client

Whitelist these **Allowed callback URLs** on client `7f7p7o6fl9tbhguv85kdonr3gr`:

- `https://hub.munero.net/auth/callback`
- `http://localhost:5173/auth/callback`

Whitelist these **Allowed sign-out URLs**:

- `https://hub.munero.net/landing`
- `http://localhost:5173/landing`

The app client must be a **public** client (no secret) with Authorization code grant and PKCE.

## Amplify + GitHub setup

1. Create a GitHub repository (e.g. `munerohub-fe`) and push the `main` branch.
2. In **AWS Amplify Console** → **Hosting** → **Host web app** → connect **GitHub**.
3. Select this repository and branch `main`. Amplify should pick up root [`amplify.yml`](amplify.yml).
4. Add an SPA rewrite so Vue Router deep links (including `/auth/callback`) work:
   - Source: `</^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webp)$)([^.]+$)/>`
   - Target: `/index.html`
   - Type: `200` (rewrite)
5. Optional: set the same `VITE_COGNITO_*` keys from [`.env.example`](.env.example) in **Amplify Console → Environment variables** if you need to override [`.env.production`](.env.production) at build time. Production redirect URI is `https://hub.munero.net/auth/callback`.
6. Save and deploy.

Deploy is handled by Amplify on push to `main`. GitHub Actions CI only type-checks and builds (no AWS credentials required).
