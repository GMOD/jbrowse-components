---
id: jbrowsewebrootmodel
title: JBrowseWebRootModel
toplevel: true
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See [Core concepts and intro to pluggable
elements](/docs/developer_guide/) for more info

note that many properties of the root model are available through the session, which
may be preferable since using getSession() is better relied on than getRoot()

### JBrowseWebRootModel - Properties

#### property: jbrowse

`jbrowse` is a mapping of the config.json into the in-memory state tree

```js
// type signature
ISnapshotProcessor<IModelType<{ configuration: AnyConfigurationSchemaType; plugins: IArrayType<IType<PluginDefinition, PluginDefinition, PluginDefinition>>; ... 5 more ...; defaultSession: IOptionalIType<...>; }, { ...; } & { ...; }, _NotCustomized, _NotCustomized>, _NotCustomized, Record<...>>
// code
jbrowse: jbrowseWebFactory(pluginManager, Session, assemblyConfigSchema)
```

#### property: configPath

```js
// type signature
IMaybe<ISimpleType<string>>
// code
configPath: types.maybe(types.string)
```

#### property: session

`session` encompasses the currently active state of the app, including
views open, tracks open in those views, etc.

```js
// type signature
IMaybe<ISnapshotProcessor<IModelType<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; name: ISimpleType<string>; margin: IType<number, number, number>; ... 11 more ...; drawerPosition: IOptionalIType<...>; }, { ...; } & ... 5 more ... & { ...; }, _NotCustomized, _NotCustomized>, _NotCustomized, _NotCustomized>>
// code
session: types.maybe(Session)
```

#### property: assemblyManager

```js
// type signature
IOptionalIType<IModelType<{ assemblies: IArrayType<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { error: Error; regions: BasicRegion[]; refNameAliases: RefNameAliases; lowerCaseRefNameAliases: RefNameAliases; cytobands: Feature[]; } & { ...; } & { ...; } & { ...; } & { ...; }, _NotCustomized, _No...
// code
assemblyManager: types.optional(AssemblyManager, {})
```

#### property: version

```js
// type signature
IMaybe<ISimpleType<string>>
// code
version: types.maybe(types.string)
```

#### property: internetAccounts

```js
// type signature
IArrayType<IAnyType>
// code
internetAccounts: types.array(
        pluginManager.pluggableMstType('internet account', 'stateModel'),
      )
```

#### property: history

used for undo/redo

```js
// type signature
IOptionalIType<IModelType<{ undoIdx: IType<number, number, number>; targetPath: IType<string, string, string>; }, { history: unknown[]; notTrackingUndo: boolean; } & { readonly canUndo: boolean; readonly canRedo: boolean; } & { ...; }, _NotCustomized, _NotCustomized>, [...]>
// code
history: types.optional(TimeTraveller, { targetPath: '../session' })
```
