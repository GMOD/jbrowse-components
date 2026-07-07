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
must satisfy .

## Members

| Member                                               | Kind    | Description |
| ---------------------------------------------------- | ------- | ----------- |
| [root](#getter-root)                                 | Getters |             |
| [version](#getter-version)                           | Getters |             |
| [gitCommit](#getter-gitcommit)                       | Getters |             |
| [history](#getter-history)                           | Getters |             |
| [assemblyManager](#getter-assemblymanager)           | Getters |             |
| [menus](#method-menus)                               | Methods |             |
| [renameCurrentSession](#action-renamecurrentsession) | Actions |             |

<details>
<summary>AppSessionMixin - Getters</summary>

#### getter: root

```ts
type root = AppRootModel
```

#### getter: version

```ts
type version = string
```

#### getter: gitCommit

```ts
type gitCommit = string | undefined
```

#### getter: history

```ts
type history =
  { canUndo: boolean; canRedo: boolean; undo(): void; redo(): void } | undefined
```

#### getter: assemblyManager

```ts
type assemblyManager = ModelInstanceTypeProps<{ assemblies: IArrayType<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { error: unknown; loadingP: Promise<void> | undefined; adapterLoads: QuickLRU<...>; ... 6 more ...; allRefNamesWithLowerCase: Set<...> | undefined; } & ... 11 more ... & { ...; }, _NotCustomized, _NotCust...
```

</details>

<details>
<summary>AppSessionMixin - Methods</summary>

#### method: menus

```ts
type menus = () => Menu[]
```

</details>

<details>
<summary>AppSessionMixin - Actions</summary>

#### action: renameCurrentSession

```ts
type renameCurrentSession = (sessionName: string) => void
```

</details>
