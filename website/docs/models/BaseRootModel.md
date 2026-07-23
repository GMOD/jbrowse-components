---
id: baserootmodel
title: BaseRootModel
sidebar_label: Root -> BaseRootModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/RootModel/BaseRootModel.ts).

## Overview

factory function for the Base-level root model shared by all products

## Members

| Member                                               | Kind       | Defined by    | Description                                                                                                         |
| ---------------------------------------------------- | ---------- | ------------- | ------------------------------------------------------------------------------------------------------------------- |
| [jbrowse](#property-jbrowse)                         | Properties | BaseRootModel | `jbrowse` is a mapping of the config.json into the in-memory state tree                                             |
| [session](#property-session)                         | Properties | BaseRootModel | `session` encompasses the currently active state of the app, including views open, tracks open in those views, etc. |
| [sessionPath](#property-sessionpath)                 | Properties | BaseRootModel |                                                                                                                     |
| [assemblyManager](#property-assemblymanager)         | Properties | BaseRootModel |                                                                                                                     |
| [rpcManager](#volatile-rpcmanager)                   | Volatiles  | BaseRootModel |                                                                                                                     |
| [adminMode](#volatile-adminmode)                     | Volatiles  | BaseRootModel |                                                                                                                     |
| [error](#volatile-error)                             | Volatiles  | BaseRootModel |                                                                                                                     |
| [textSearchManager](#volatile-textsearchmanager)     | Volatiles  | BaseRootModel |                                                                                                                     |
| [pluginManager](#volatile-pluginmanager)             | Volatiles  | BaseRootModel |                                                                                                                     |
| [setError](#action-seterror)                         | Actions    | BaseRootModel |                                                                                                                     |
| [setSession](#action-setsession)                     | Actions    | BaseRootModel | Sets the active session.                                                                                            |
| [setDefaultSession](#action-setdefaultsession)       | Actions    | BaseRootModel |                                                                                                                     |
| [setSessionPath](#action-setsessionpath)             | Actions    | BaseRootModel |                                                                                                                     |
| [renameCurrentSession](#action-renamecurrentsession) | Actions    | BaseRootModel |                                                                                                                     |

<details>
<summary>BaseRootModel - Properties</summary>

#### property: jbrowse

`jbrowse` is a mapping of the config.json into the in-memory state tree

```ts
// type signature
type jbrowse = IAnyType
// code
jbrowse: jbrowseModelType
```

#### property: session

`session` encompasses the currently active state of the app, including views
open, tracks open in those views, etc.

```ts
// type signature
type session = IMaybe<IAnyType>
// code
session: types.maybe(sessionModelType)
```

</details>

<details>
<summary>BaseRootModel - Properties (other undocumented members)</summary>

| Member                                                     | Type                                               |
| ---------------------------------------------------------- | -------------------------------------------------- |
| <span id="property-sessionpath">sessionPath</span>         | `IOptionalIType<ISimpleType<string>, [undefined]>` |
| <span id="property-assemblymanager">assemblyManager</span> | `IOptionalIType<IModelType<…>, [undefined]>`       |

</details>

<details>
<summary>BaseRootModel - Volatiles</summary>

| Member                                                         | Type                |
| -------------------------------------------------------------- | ------------------- |
| <span id="volatile-rpcmanager">rpcManager</span>               | `RpcManager`        |
| <span id="volatile-adminmode">adminMode</span>                 | `false`             |
| <span id="volatile-error">error</span>                         | `unknown`           |
| <span id="volatile-textsearchmanager">textSearchManager</span> | `TextSearchManager` |
| <span id="volatile-pluginmanager">pluginManager</span>         | `PluginManager`     |

</details>

<details>
<summary>BaseRootModel - Actions</summary>

#### action: setSession

Sets the active session. Remaps any legacy display type names (e.g.
LinearPileupDisplay → LinearAlignmentsDisplay), then walks the resulting MST
tree to drop open tracks whose config can't hydrate so shared sessions still
load when referencing tracks that no longer exist. Dropped tracks are surfaced
to the user via a snackbar. If filtering throws, the previous session is
restored.

```ts
type setSession = (sessionSnapshot?: any) => void
```

</details>

<details>
<summary>BaseRootModel - Actions (other undocumented members)</summary>

| Member                                                             | Type                        |
| ------------------------------------------------------------------ | --------------------------- |
| <span id="action-seterror">setError</span>                         | `(error: unknown) => void`  |
| <span id="action-setdefaultsession">setDefaultSession</span>       | `() => void`                |
| <span id="action-setsessionpath">setSessionPath</span>             | `(path: string) => void`    |
| <span id="action-renamecurrentsession">renameCurrentSession</span> | `(newName: string) => void` |

</details>
