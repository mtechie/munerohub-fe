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

`metadata.icon` is a CSS class on the tile (`hub-icon-*` in [`src/launchpad/icons.css`](../src/launchpad/icons.css)). If omitted, the tile shows a letter mark. Optional `iconColor` and `textColor` are CSS colors for the icon (or letter mark) and the tile name. Section records may set `icon` the same way (drawn next to the section title).

Layout comes from the `sections` array on `GET /privileges` (cached as `munero.hub.sections`). Each privilege only stores `metadata.sectionId`. Privileges without a matching catalog `sectionId` are not shown.

Section specs:

- `pin`: `'start' | 'end' | 'top' | 'bottom'`
- `layout`: `'grid'` (default) or `'list'`
- `showIcon` (default true), `showTags` (default false), `showDescription` (default false)

The launchpad keeps a snapshot of the grid and does not rebuild when the privilege or section cache changes until the user clicks **Refresh Now**.

Privilege `metadata`:

```json
{
  "url": "https://giftlov.munero.net",
  "icon": "hub-icon-giftlov",
  "iconColor": "#C62828",
  "textColor": "#8A1F1F",
  "order": 2,
  "sectionId": "my-applications"
}
```

```json
{
  "url": "https://pxm-staging.munero.net",
  "icon": "hub-icon-people",
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
    "order": 1,
    "icon": "hub-icon-apps",
    "layout": "grid",
    "showIcon": true,
    "showTags": false,
    "showDescription": false
  },
  {
    "id": "test-environments",
    "title": "Test Environments",
    "row": 2,
    "weight": 12,
    "order": 1,
    "pin": "bottom",
    "icon": "hub-icon-beaker",
    "backgroundColor": "#FFF9F1",
    "layout": "grid",
    "showIcon": true,
    "showTags": true,
    "showDescription": true
  },
  {
    "id": "policies",
    "title": "Policies",
    "row": 1,
    "weight": 4,
    "order": 2,
    "pin": "end",
    "icon": "hub-icon-document",
    "layout": "list",
    "showIcon": false,
    "showTags": false,
    "showDescription": false
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
