---
id: embeddedrootmodel
title: EmbeddedRootModel
sidebar_label: Root -> EmbeddedRootModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/embedded-core/src/createEmbeddedRootModel.ts).

## Overview

Root model shared by the single-view embedded products
(react-linear-genome-view, react-circular-genome-view). Each product supplies
its own model name, version, and session model, and may `.props()` on extra
fields (e.g. the LGV `disableAddTracks`/`drawerViewHeight`). Internet accounts
come from the same product-core mixin the web/desktop root models use, so config
`internetAccounts` are auto-initialized (no manual wiring needed).

## Members

| Member                                                                   | Kind       | Defined by                                        | Description |
| ------------------------------------------------------------------------ | ---------- | ------------------------------------------------- | ----------- |
| [config](#property-config)                                               | Properties | EmbeddedRootModel                                 |             |
| [session](#property-session)                                             | Properties | EmbeddedRootModel                                 |             |
| [assemblyManager](#property-assemblymanager)                             | Properties | EmbeddedRootModel                                 |             |
| [error](#volatile-error)                                                 | Volatiles  | EmbeddedRootModel                                 |             |
| [adminMode](#volatile-adminmode)                                         | Volatiles  | EmbeddedRootModel                                 |             |
| [version](#volatile-version)                                             | Volatiles  | EmbeddedRootModel                                 |             |
| [rpcManager](#volatile-rpcmanager)                                       | Volatiles  | EmbeddedRootModel                                 |             |
| [textSearchManager](#volatile-textsearchmanager)                         | Volatiles  | EmbeddedRootModel                                 |             |
| [jbrowse](#getter-jbrowse)                                               | Getters    | EmbeddedRootModel                                 |             |
| [pluginManager](#getter-pluginmanager)                                   | Getters    | EmbeddedRootModel                                 |             |
| [setSession](#action-setsession)                                         | Actions    | EmbeddedRootModel                                 |             |
| [renameCurrentSession](#action-renamecurrentsession)                     | Actions    | EmbeddedRootModel                                 |             |
| [setError](#action-seterror)                                             | Actions    | EmbeddedRootModel                                 |             |
| [internetAccounts](#property-internetaccounts)                           | Properties | [InternetAccountsMixin](../internetaccountsmixin) |             |
| [initializeInternetAccount](#action-initializeinternetaccount)           | Actions    | [InternetAccountsMixin](../internetaccountsmixin) |             |
| [createEphemeralInternetAccount](#action-createephemeralinternetaccount) | Actions    | [InternetAccountsMixin](../internetaccountsmixin) |             |
| [findAppropriateInternetAccount](#action-findappropriateinternetaccount) | Actions    | [InternetAccountsMixin](../internetaccountsmixin) |             |

<details>
<summary>EmbeddedRootModel - Properties</summary>

| Member                                                     | Type                                                                                                                                                                                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="property-config">config</span>                   | `IModelType<…>; assembly: IAnyType; tracks: IArrayType<…>; internetAccounts: IArrayType<…>; connections: IArrayType<…>; aggregateTextSearchAdapters: IArrayType<…>; plugins: IType<…>; }, {…}, _NotCustomized, _NotCustomized>` |
| <span id="property-session">session</span>                 | `SESSION`                                                                                                                                                                                                                       |
| <span id="property-assemblymanager">assemblyManager</span> | `IOptionalIType<IModelType<…>, [undefined]>`                                                                                                                                                                                    |

</details>

<details>
<summary>EmbeddedRootModel - Volatiles</summary>

| Member                                                         | Type                |
| -------------------------------------------------------------- | ------------------- |
| <span id="volatile-error">error</span>                         | `unknown`           |
| <span id="volatile-adminmode">adminMode</span>                 | `false`             |
| <span id="volatile-version">version</span>                     | `string`            |
| <span id="volatile-rpcmanager">rpcManager</span>               | `RpcManager`        |
| <span id="volatile-textsearchmanager">textSearchManager</span> | `TextSearchManager` |

</details>

<details>
<summary>EmbeddedRootModel - Getters</summary>

| Member                                               | Type                                                                                                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| <span id="getter-jbrowse">jbrowse</span>             | `ModelPropertiesDeclarationToProperties<…>; session: SESSION; assemblyManager: IOptionalIType<IModelType<…>, [undefined]>; }>["config"]["Type"]` |
| <span id="getter-pluginmanager">pluginManager</span> | `PluginManager`                                                                                                                                  |

</details>

<details>
<summary>EmbeddedRootModel - Actions</summary>

| Member                                                             | Type                                             |
| ------------------------------------------------------------------ | ------------------------------------------------ |
| <span id="action-setsession">setSession</span>                     | `(sessionSnapshot: SnapshotIn<SESSION>) => void` |
| <span id="action-renamecurrentsession">renameCurrentSession</span> | `(sessionName: string) => void`                  |
| <span id="action-seterror">setError</span>                         | `(error: unknown) => void`                       |

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from InternetAccountsMixin</summary>

[InternetAccountsMixin →](../internetaccountsmixin)

**Properties**

| Member                                                       | Type                   |
| ------------------------------------------------------------ | ---------------------- |
| <span id="property-internetaccounts">internetAccounts</span> | `IArrayType<IAnyType>` |

**Actions**

| Member                                                                                 | Type                                                                                                         |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| <span id="action-initializeinternetaccount">initializeInternetAccount</span>           | `(internetAccountConfig: ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>, initialSnapshot?: any) => any` |
| <span id="action-createephemeralinternetaccount">createEphemeralInternetAccount</span> | `(internetAccountId: string, initialSnapshot: Record<string, unknown>, url: string) => any`                  |
| <span id="action-findappropriateinternetaccount">findAppropriateInternetAccount</span> | `(location: UriLocation) => any`                                                                             |

</details>
