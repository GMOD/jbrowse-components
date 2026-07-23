---
id: websessionmanagementmixin
title: WebSessionManagementMixin
sidebar_label: Mixin -> WebSessionManagementMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/web-core/src/WebSessionManagement.ts).

## Overview

Saved-session-database actions (favorites, recent sessions, activate/delete)
delegating to the root's AbstractWebSessionDbRootModel. Composed only by the
full-app jbrowse-web session; react-app omits it (its root has no session
database).

## Members

| Member                                                     | Kind    | Defined by                | Description |
| ---------------------------------------------------------- | ------- | ------------------------- | ----------- |
| [savedSessionMetadata](#getter-savedsessionmetadata)       | Getters | WebSessionManagementMixin |             |
| [deleteSavedSession](#action-deletesavedsession)           | Actions | WebSessionManagementMixin |             |
| [setSavedSessionFavorite](#action-setsavedsessionfavorite) | Actions | WebSessionManagementMixin |             |
| [renameSavedSession](#action-renamesavedsession)           | Actions | WebSessionManagementMixin |             |
| [activateSession](#action-activatesession)                 | Actions | WebSessionManagementMixin |             |

<details>
<summary>WebSessionManagementMixin - Getters</summary>

#### getter: savedSessionMetadata

```ts
type savedSessionMetadata = SessionMetadata[] | undefined
```

</details>

<details>
<summary>WebSessionManagementMixin - Actions</summary>

#### action: deleteSavedSession

```ts
type deleteSavedSession = (id: string) => Promise<void>
```

#### action: setSavedSessionFavorite

```ts
type setSavedSessionFavorite = (id: string, favorite: boolean) => Promise<void>
```

#### action: renameSavedSession

```ts
type renameSavedSession = (id: string, name: string) => Promise<void>
```

#### action: activateSession

```ts
type activateSession = (id: string) => Promise<void>
```

</details>
