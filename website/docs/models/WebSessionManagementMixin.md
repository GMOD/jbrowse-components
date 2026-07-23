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

| Member                                                             | Type                             |
| ------------------------------------------------------------------ | -------------------------------- |
| <span id="getter-savedsessionmetadata">savedSessionMetadata</span> | `SessionMetadata[] \| undefined` |

</details>

<details>
<summary>WebSessionManagementMixin - Actions</summary>

| Member                                                                   | Type                                               |
| ------------------------------------------------------------------------ | -------------------------------------------------- |
| <span id="action-deletesavedsession">deleteSavedSession</span>           | `(id: string) => Promise<void>`                    |
| <span id="action-setsavedsessionfavorite">setSavedSessionFavorite</span> | `(id: string, favorite: boolean) => Promise<void>` |
| <span id="action-renamesavedsession">renameSavedSession</span>           | `(id: string, name: string) => Promise<void>`      |
| <span id="action-activatesession">activateSession</span>                 | `(id: string) => Promise<void>`                    |

</details>
