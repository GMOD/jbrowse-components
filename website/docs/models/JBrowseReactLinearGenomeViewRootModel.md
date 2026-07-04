---
id: jbrowsereactlineargenomeviewrootmodel
title: JBrowseReactLinearGenomeViewRootModel
sidebar_label: Root -> JBrowseReactLinearGenomeViewRootModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/src/createModel/createModel.ts).

## Overview

<details>
<summary>JBrowseReactLinearGenomeViewRootModel - Properties</summary>

#### property: config

```ts
// type signature
type config = IModelType<{ configuration: ConfigurationSchemaType<{ rpc: ConfigurationSchemaType<{ defaultDriver: { type: string; description: string; defaultValue: string; advanced: true; }; workerCount: { type: string; description: string; defaultValue: number; advanced: true; }; }, ConfigurationSchemaOptions<...>>; ... 4 more ...
// code
config: createConfigModel(pluginManager, assemblyConfig)
```

#### property: session

```ts
// type signature
type session = IModelType<_OverrideProps<Omit<_OverrideProps<Omit<_OverrideProps<_OverrideProps<Omit<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; name: ISimpleType<string>; margin: IOptionalIType<ISimpleType<number>, [...]>; focusedViewId: IMaybe<...>; }, never>, { ...; }>, { ...; }>, never>, _OverrideProps<...>>, never...
// code
session: Session
```

#### property: assemblyManager

```ts
// type signature
type assemblyManager = IOptionalIType<IModelType<{ assemblies: IArrayType<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { error: unknown; loadingP: Promise<void> | undefined; adapterLoads: QuickLRU<...>; ... 6 more ...; allRefNamesWithLowerCase: Set<...> | undefined; } & ... 11 more ... & { ...; }, _NotCustomized, _NotC...
// code
assemblyManager: types.optional(AssemblyManager, {})
```

#### property: disableAddTracks

```ts
// type signature
type disableAddTracks = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
disableAddTracks: types.stripDefault(types.boolean, false)
```

#### property: drawerViewHeight

```ts
// type signature
type drawerViewHeight = IOptionalIType<ISimpleType<string>, [undefined]>
// code
drawerViewHeight: types.stripDefault(types.string, '100vh')
```

#### property: internetAccounts

```ts
// type signature
type internetAccounts = IArrayType<IAnyType>
// code
internetAccounts: types.array(
  pluginManager.pluggableMstType('internet account', 'stateModel'),
)
```

</details>

<details>
<summary>JBrowseReactLinearGenomeViewRootModel - Volatiles</summary>

#### volatile: error

```ts
// type signature
type error = unknown
// code
error: undefined as unknown
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

</details>

<details>
<summary>JBrowseReactLinearGenomeViewRootModel - Getters</summary>

#### getter: jbrowse

```ts
type jbrowse = ModelInstanceTypeProps<{ configuration: ConfigurationSchemaType<{ rpc: ConfigurationSchemaType<{ defaultDriver: { type: string; description: string; defaultValue: string; advanced: true; }; workerCount: { type: string; description: string; defaultValue: number; advanced: true; }; }, ConfigurationSchemaOptions<...>>;...
```

</details>

<details>
<summary>JBrowseReactLinearGenomeViewRootModel - Actions</summary>

#### action: setSession

```ts
type setSession = (sessionSnapshot: ModelCreationType<ExtractCFromProps<_OverrideProps<Omit<_OverrideProps<Omit<_OverrideProps<_OverrideProps<Omit<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; name: ISimpleType<string>; margin: IOptionalIType<ISimpleType<number>, [...]>; focusedViewId: IMaybe<...>; }, never>, { ...; }>, { ....
```

#### action: renameCurrentSession

```ts
type renameCurrentSession = (sessionName: string) => void
```

#### action: setError

```ts
type setError = (error: unknown) => void
```

#### action: addInternetAccount

```ts
type addInternetAccount = (acct: any) => void
```

#### action: findAppropriateInternetAccount

```ts
type findAppropriateInternetAccount = (location: UriLocation) => any
```

</details>
