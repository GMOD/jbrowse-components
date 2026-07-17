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

#### property: config

```ts
// type signature
type config = IModelType<{ configuration: ConfigurationSchemaType<{ rpc: ConfigurationSchemaType<{ defaultDriver: { type: string; description: string; defaultValue: string; advanced: true; }; workerCount: { type: string; description: string; defaultValue: number; advanced: true; }; }, ConfigurationSchemaOptions<...>>; ... 4 more ...
// code
config: createConfigModel(pluginManager, assemblyConfigSchema)
```

#### property: session

```ts
// type signature
type session = SESSION
// code
session: sessionModelType
```

#### property: assemblyManager

```ts
// type signature
type assemblyManager = IOptionalIType<IModelType<{ assemblies: IArrayType<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { error: unknown; loadingP: Promise<void> | undefined; adapterLoads: QuickLRU<...>; ... 5 more ...; lowerCaseRefNameAliases: RefNameAliases | undefined; } & ... 11 more ... & { ...; }, _NotCustomized, ...
// code
assemblyManager: types.optional(
          assemblyManagerFactory(assemblyConfigSchema, pluginManager),
          {},
        )
```

</details>

<details>
<summary>EmbeddedRootModel - Volatiles</summary>

#### volatile: error

```ts
// type signature
type error = unknown
// code
error: undefined as unknown
```

#### volatile: adminMode

```ts
// type signature
type adminMode = false
// code
adminMode: false
```

#### volatile: version

```ts
// type signature
type version = string
// code
version
```

#### volatile: rpcManager

```ts
// type signature
type rpcManager = RpcManager
// code
rpcManager: new RpcManager(pluginManager, self.config.configuration.rpc, {
  makeWorkerInstance,

  defaultDriverName: makeWorkerInstance
    ? 'WebWorkerRpcDriver'
    : 'MainThreadRpcDriver',
})
```

#### volatile: textSearchManager

```ts
// type signature
type textSearchManager = TextSearchManager
// code
textSearchManager: new TextSearchManager(pluginManager)
```

</details>

<details>
<summary>EmbeddedRootModel - Getters</summary>

#### getter: jbrowse

```ts
type jbrowse = ModelPropertiesDeclarationToProperties<{ config: IModelType<{ configuration: ConfigurationSchemaType<{ rpc: ConfigurationSchemaType<{ defaultDriver: { type: string; description: string; defaultValue: string; advanced: true; }; workerCount: { type: string; description: string; defaultValue: number; advanced: true; };...
```

#### getter: pluginManager

```ts
type pluginManager = PluginManager
```

</details>

<details>
<summary>EmbeddedRootModel - Actions</summary>

#### action: setSession

```ts
type setSession = (sessionSnapshot: SnapshotIn<SESSION>) => void
```

#### action: renameCurrentSession

```ts
type renameCurrentSession = (sessionName: string) => void
```

#### action: setError

```ts
type setError = (error: unknown) => void
```

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from InternetAccountsMixin</summary>

[InternetAccountsMixin →](../internetaccountsmixin)

**Properties**

#### property: internetAccounts

```ts
// type signature
type internetAccounts = IArrayType<IAnyType>
// code
internetAccounts: types.array(
  pluginManager.pluggableMstType('internet account', 'stateModel'),
)
```

**Actions**

#### action: initializeInternetAccount

```ts
type initializeInternetAccount = (internetAccountConfig: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>, initialSnapshot?: any) => any
```

#### action: createEphemeralInternetAccount

```ts
type createEphemeralInternetAccount = (
  internetAccountId: string,
  initialSnapshot: Record<string, unknown>,
  url: string,
) => any
```

#### action: findAppropriateInternetAccount

```ts
type findAppropriateInternetAccount = (location: UriLocation) => any
```

</details>
