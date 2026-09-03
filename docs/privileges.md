# Privilege helpers (show / hide tiles)

UI-only checks against the MuneroHub privileges cached in `localStorage`. APIs must still enforce authorization.

Import from [`src/auth/privileges.ts`](../src/auth/privileges.ts). Helpers read the reactive store, so `v-if` updates when the cache changes. For imperative logic (not only `v-if`), use `onPrivilegesChanged`.

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
