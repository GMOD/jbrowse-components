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

<details open>
<summary>WebSessionManagementMixin - Getters</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                 | Signature                        |
| ------------------------------------------------------ | -------------------------------- |
| [`savedSessionMetadata`](#getter-savedsessionmetadata) | `SessionMetadata[] \| undefined` |

</details>

<details>
<summary>WebSessionManagementMixin - Getters (all signatures)</summary>

#### getter: savedSessionMetadata

```ts
type savedSessionMetadata = SessionMetadata[] | undefined
```

</details>

<details open>
<summary>WebSessionManagementMixin - Actions</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                       | Signature                                          |
| ------------------------------------------------------------ | -------------------------------------------------- |
| [`deleteSavedSession`](#action-deletesavedsession)           | `(id: string) => Promise<void>`                    |
| [`setSavedSessionFavorite`](#action-setsavedsessionfavorite) | `(id: string, favorite: boolean) => Promise<void>` |
| [`renameSavedSession`](#action-renamesavedsession)           | `(id: string, name: string) => Promise<void>`      |
| [`activateSession`](#action-activatesession)                 | `(id: string) => Promise<void>`                    |

</details>

<details>
<summary>WebSessionManagementMixin - Actions (all signatures)</summary>

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
