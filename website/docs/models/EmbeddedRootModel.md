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

| Member                                               | Kind       | Description |
| ---------------------------------------------------- | ---------- | ----------- |
| [config](#property-config)                           | Properties |             |
| [session](#property-session)                         | Properties |             |
| [assemblyManager](#property-assemblymanager)         | Properties |             |
| [error](#volatile-error)                             | Volatiles  |             |
| [adminMode](#volatile-adminmode)                     | Volatiles  |             |
| [version](#volatile-version)                         | Volatiles  |             |
| [rpcManager](#volatile-rpcmanager)                   | Volatiles  |             |
| [textSearchManager](#volatile-textsearchmanager)     | Volatiles  |             |
| [jbrowse](#getter-jbrowse)                           | Getters    |             |
| [pluginManager](#getter-pluginmanager)               | Getters    |             |
| [setSession](#action-setsession)                     | Actions    |             |
| [renameCurrentSession](#action-renamecurrentsession) | Actions    |             |
| [setError](#action-seterror)                         | Actions    |             |

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [InternetAccountsMixin](../internetaccountsmixin)

**Properties:**
[internetAccounts](../internetaccountsmixin#property-internetaccounts)

**Actions:**
[initializeInternetAccount](../internetaccountsmixin#action-initializeinternetaccount),
[createEphemeralInternetAccount](../internetaccountsmixin#action-createephemeralinternetaccount),
[findAppropriateInternetAccount](../internetaccountsmixin#action-findappropriateinternetaccount)

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
type assemblyManager = IOptionalIType<IModelType<{ assemblies: IArrayType<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { error: unknown; loadingP: Promise<void> | undefined; adapterLoads: QuickLRU<...>; ... 6 more ...; allRefNamesWithLowerCase: Set<...> | undefined; } & ... 11 more ... & { ...; }, _NotCustomized, _NotC...
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
