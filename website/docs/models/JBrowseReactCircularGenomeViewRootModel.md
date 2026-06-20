---
id: jbrowsereactcirculargenomeviewrootmodel
title: JBrowseReactCircularGenomeViewRootModel
sidebar_label: Root -> JBrowseReactCircularGenomeViewRootModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-circular-genome-view/src/createModel/createModel.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/JBrowseReactCircularGenomeViewRootModel.md)

## Overview

<details open>
<summary>JBrowseReactCircularGenomeViewRootModel - Properties</summary>

#### property: config

```ts
// type signature
type config = IModelType<{ configuration: ConfigurationSchemaType<{ rpc: ConfigurationSchemaType<{ defaultDriver: { type: string; description: string; defaultValue: string; advanced: true; }; workerCount: { type: string; description: string; defaultValue: number; advanced: true; }; }, ConfigurationSchemaOptions<...>>; ... 5 more ...
// code
config: createConfigModel(pluginManager, assemblyConfigSchema)
```

#### property: session

```ts
// type signature
type session = IModelType<_OverrideProps<Omit<Omit<_OverrideProps<_OverrideProps<_OverrideProps<Omit<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; name: ISimpleType<string>; margin: IOptionalIType<ISimpleType<number>, [...]>; focusedViewId: IMaybe<...>; }, never>, { ...; }>, { ...; }>, Omit<...>>, never>, never>, { ...; ...
// code
session: Session
```

#### property: assemblyManager

```ts
// type signature
type assemblyManager = IOptionalIType<IModelType<{ assemblies: IArrayType<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { error: unknown; loadingP: Promise<void> | undefined; adapterLoads: QuickLRU<...>; ... 6 more ...; allRefNamesWithLowerCase: Set<...> | undefined; } & ... 11 more ... & { ...; }, _NotCustomized, _NotC...
// code
assemblyManager: types.optional(assemblyManagerType, {})
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

<details open>
<summary>JBrowseReactCircularGenomeViewRootModel - Volatiles</summary>

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

<details open>
<summary>JBrowseReactCircularGenomeViewRootModel - Getters</summary>

#### getter: jbrowse

```ts
type jbrowse = ModelInstanceTypeProps<{ configuration: ConfigurationSchemaType<{ rpc: ConfigurationSchemaType<{ defaultDriver: { type: string; description: string; defaultValue: string; advanced: true; }; workerCount: { type: string; description: string; defaultValue: number; advanced: true; }; }, ConfigurationSchemaOptions<...>>;...
```

#### getter: pluginManager

```ts
type pluginManager = PluginManager
```

</details>

<details open>
<summary>JBrowseReactCircularGenomeViewRootModel - Actions</summary>

#### action: setSession

```ts
type setSession = (sessionSnapshot: ModelCreationType<ExtractCFromProps<_OverrideProps<Omit<Omit<_OverrideProps<_OverrideProps<_OverrideProps<Omit<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; name: ISimpleType<string>; margin: IOptionalIType<ISimpleType<number>, [...]>; focusedViewId: IMaybe<...>; }, never>, { ...; }>, { ....
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
type addInternetAccount = (internetAccount: any) => void
```

#### action: findAppropriateInternetAccount

```ts
type findAppropriateInternetAccount = (location: UriLocation) => any
```

</details>
