---
id: jbrowsewebrootmodel
title: JBrowseWebRootModel
toplevel: true
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

## Source file

[products/jbrowse-web/src/rootModel.ts](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-web/src/rootModel.ts)

## Docs

note that many properties of the root model are available through the session,
which may be preferable since using getSession() is better relied on than
getRoot()

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

`session` encompasses the currently active state of the app, including views
open, tracks open in those views, etc.

```js
// type signature
IMaybe<ISnapshotProcessor<IModelType<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; name: ISimpleType<string>; margin: IType<number, number, number>; ... 11 more ...; drawerPosition: IOptionalIType<...>; }, { ...; } & ... 9 more ... & { ...; }, _NotCustomized, _NotCustomized>, _NotCustomized, _NotCustomized>>
// code
session: types.maybe(Session)
```

#### property: assemblyManager

```js
// type signature
IOptionalIType<IModelType<{ assemblies: IArrayType<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { error: unknown; loaded: boolean; loadingP: Promise<void>; volatileRegions: BasicRegion[]; refNameAliases: RefNameAliases; lowerCaseRefNameAliases: RefNameAliases; cytobands: Feature[]; } & ... 4 more...
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

### JBrowseWebRootModel - Getters

#### getter: savedSessions

```js
// type
any[]
```

#### getter: autosaveId

```js
// type
string
```

#### getter: previousAutosaveId

```js
// type
string
```

#### getter: savedSessionNames

```js
// type
any[]
```

#### getter: currentSessionId

```js
// type
string
```

### JBrowseWebRootModel - Methods

#### method: localStorageId

```js
// type signature
localStorageId: (name: string) => string
```

### JBrowseWebRootModel - Actions

#### action: setSession

```js
// type signature
setSession: (sessionSnapshot?: ModelCreationType<ExtractCFromProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; name: ISimpleType<string>; margin: IType<number, number, number>; ... 11 more ...; drawerPosition: IOptionalIType<...>; }>>) => void
```

#### action: setMenus

```js
// type signature
setMenus: (newMenus: Menu[]) => void
```

#### action: appendMenu

Add a top-level menu

```js
// type signature
appendMenu: (menuName: string) => number
```

#### action: insertMenu

Insert a top-level menu

```js
// type signature
insertMenu: (menuName: string, position: number) => number
```

#### action: appendToMenu

Add a menu item to a top-level menu

```js
// type signature
appendToMenu: (menuName: string, menuItem: MenuItem) => number
```

#### action: insertInMenu

Insert a menu item into a top-level menu

```js
// type signature
insertInMenu: (menuName: string, menuItem: MenuItem, position: number) => number
```

#### action: appendToSubMenu

Add a menu item to a sub-menu

```js
// type signature
appendToSubMenu: (menuPath: string[], menuItem: MenuItem) => number
```

#### action: insertInSubMenu

Insert a menu item into a sub-menu

```js
// type signature
insertInSubMenu: (menuPath: string[], menuItem: MenuItem, position: number) =>
  number
```
