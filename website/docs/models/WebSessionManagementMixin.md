---
id: websessionmanagementmixin
title: WebSessionManagementMixin
sidebar_label: Mixin -> WebSessionManagementMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/web-core/src/WebSessionManagement.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/WebSessionManagementMixin.md)

## Overview

Saved-session-database actions (favorites, recent sessions, activate/delete)
delegating to the root's . Composed only by the full-app jbrowse-web session;
react-app omits it (its root has no session database).

<details>
<summary>WebSessionManagementMixin - Getters</summary>

#### getter: savedSessionMetadata

```js
// type
SessionMetadata[] | undefined
```

</details>

<details>
<summary>WebSessionManagementMixin - Actions</summary>

#### action: deleteSavedSession

```js
// type signature
deleteSavedSession: (id: string) => Promise<void>
```

#### action: setSavedSessionFavorite

```js
// type signature
setSavedSessionFavorite: (id: string, favorite: boolean) => Promise<void>
```

#### action: renameSavedSession

```js
// type signature
renameSavedSession: (id: string, name: string) => Promise<void>
```

#### action: activateSession

```js
// type signature
activateSession: (id: string) => Promise<void>
```

</details>
