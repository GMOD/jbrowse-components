---
id: appsessionmixin
title: AppSessionMixin
sidebar_label: Mixin -> AppSessionMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/AppSession/AppSessionMixin.ts).

## Overview

Session getters shared by the "app" products (desktop + web) that simply
delegate to the root model — `version`, `history`, `menus`, `assemblyManager` —
plus `renameCurrentSession`. Centralized here so the products compose one mixin
instead of re-declaring (and diverging on) the same root delegations. The root
must satisfy AppRootModel.

## Members

| Member                                               | Kind    | Defined by      | Description |
| ---------------------------------------------------- | ------- | --------------- | ----------- |
| [root](#getter-root)                                 | Getters | AppSessionMixin |             |
| [version](#getter-version)                           | Getters | AppSessionMixin |             |
| [gitCommit](#getter-gitcommit)                       | Getters | AppSessionMixin |             |
| [history](#getter-history)                           | Getters | AppSessionMixin |             |
| [assemblyManager](#getter-assemblymanager)           | Getters | AppSessionMixin |             |
| [menus](#method-menus)                               | Methods | AppSessionMixin |             |
| [renameCurrentSession](#action-renamecurrentsession) | Actions | AppSessionMixin |             |

<details>
<summary>AppSessionMixin - Getters</summary>

| Member                                                   | Type                                                                               |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| <span id="getter-root">root</span>                       | `AppRootModel`                                                                     |
| <span id="getter-version">version</span>                 | `string`                                                                           |
| <span id="getter-gitcommit">gitCommit</span>             | `string \| undefined`                                                              |
| <span id="getter-history">history</span>                 | `{ canUndo: boolean; canRedo: boolean; undo(): void; redo(): void; } \| undefined` |
| <span id="getter-assemblymanager">assemblyManager</span> | `ModelInstanceTypeProps<…> & {…} & {…} & {…} & {…} & IStateTreeNode<…>`            |

</details>

<details>
<summary>AppSessionMixin - Methods</summary>

| Member                               | Type           |
| ------------------------------------ | -------------- |
| <span id="method-menus">menus</span> | `() => Menu[]` |

</details>

<details>
<summary>AppSessionMixin - Actions</summary>

| Member                                                             | Type                            |
| ------------------------------------------------------------------ | ------------------------------- |
| <span id="action-renamecurrentsession">renameCurrentSession</span> | `(sessionName: string) => void` |

</details>
