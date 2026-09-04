# Privilege helpers (show / hide tiles)

UI-only checks against the MuneroHub privileges cached in `localStorage`. APIs must still enforce authorization.

Import from [`src/auth/privileges.ts`](../src/auth/privileges.ts). Helpers read the reactive store, so `v-if` updates when the cache changes. For imperative logic (not only `v-if`), use `onPrivilegesChanged`. The launchpad on `/` shows assigned apps from this cache. The `/debug` page has a **Privilege helper tester** card to try each method against the live cache.

```ts
import {
  getPrivilege,
  hasAllPrivileges,
  hasAnyPrivilege,
  hasPrivilege,
  listPrivilegesByType,
  onPrivilegesChanged,
  privilegeAppUrl,
} from '../auth/privileges'
```

## `hasPrivilege(identifier)`

True if `privilegeIdentifier` is in the cache (`GIFTLOV`, `PXM`, …).

```vue
<div v-if="hasPrivilege('GIFTLOV')">GiftLov</div>
```

## `hasAnyPrivilege(...identifiers)`

True if **any** of the ids is present.

```vue
<div v-if="hasAnyPrivilege('GIFTLOV', 'PXM')">At least one app</div>
```

## `hasAllPrivileges(...identifiers)`

True if **all** of the ids are present. Empty argument list is false.

```vue
<div v-if="hasAllPrivileges('GIFTLOV', 'PXM')">Both apps</div>
```

## Launchpad `metadata`

`metadata.icon` is a CSS class on the tile. GiftLov and PXM have built-in marks (`hub-icon-giftlov`, `hub-icon-pxm`) when `icon` is omitted.

Layout comes from the `sections` array on `GET /privileges` (cached as `munero.hub.sections`). Each privilege only stores `metadata.sectionId`. `section.pin` is `'start' | 'end' | 'top' | 'bottom'`. A pinned section takes that edge; other sections flow around it. The launchpad keeps a snapshot of the grid and does not rebuild when the privilege or section cache changes until the user clicks **Refresh Now**.

Privilege `metadata`:

```json
{
  "url": "https://giftlov.munero.net",
  "icon": "hub-icon-giftlov",
  "order": 2,
  "sectionId": "my-applications"
}
```

```json
{
  "url": "https://pxm-staging.munero.net",
  "icon": "hub-icon-pxm",
  "order": 1,
  "tags": ["STAGING"],
  "sectionId": "test-environments"
}
```

`sections` catalog (same response):

```json
[
  {
    "id": "my-applications",
    "title": "My applications",
    "row": 1,
    "weight": 8,
    "order": 1
  },
  {
    "id": "test-environments",
    "title": "Test Environments",
    "row": 2,
    "weight": 12,
    "order": 1,
    "pin": "bottom"
  }
]
```

## `getPrivilege(identifier)`

Full privilege record, or `undefined`.

```ts
const giftlov = getPrivilege('GIFTLOV')
giftlov?.privilegeName
giftlov?.metadata?.url
```

## `listPrivilegesByType(typeId)`

Privileges whose `privilegeTypeId` matches (e.g. `'APP'`).

```vue
<a v-for="app in listPrivilegesByType('APP')" :key="app.privilegeIdentifier" :href="app.metadata?.url">
  {{ app.privilegeName }}
</a>
```

## `privilegeAppUrl(identifier)`

`metadata.url` for that id, or `undefined`.

```vue
<a v-if="privilegeAppUrl('GIFTLOV')" :href="privilegeAppUrl('GIFTLOV')">Open GiftLov</a>
```

## `onPrivilegesChanged(listener)`

Fires only when the list **actually changes**. Returns an unsubscribe function.

```ts
onMounted(() => {
  const stop = onPrivilegesChanged((items) => {
    // show/hide from items or hasPrivilege()
  })
  onUnmounted(stop)
})
```
