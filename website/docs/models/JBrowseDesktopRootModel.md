---
id: jbrowsedesktoprootmodel
title: JBrowseDesktopRootModel
toplevel: true
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

## Source file

[products/jbrowse-desktop/src/rootModel.ts](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-desktop/src/rootModel.ts)

## Docs

note that many properties of the root model are available through the session,
which may be preferable since using getSession() is better relied on than
getRoot()

### JBrowseDesktopRootModel - Properties

#### property: jbrowse

`jbrowse` is a mapping of the config.json into the in-memory state tree

```js
// type signature
IModelType<{ configuration: ConfigurationSchemaType<{ rpc: ConfigurationSchemaType<{ defaultDriver: { type: string; description: string; defaultValue: string; }; drivers: IOptionalIType<IMapType<ITypeUnion<ModelCreationType<ExtractCFromProps<Record<string, any>>>, ModelSnapshotType<...>, {} & ... 1 more ... & NonEmp...
// code
jbrowse: JBrowseDesktop(pluginManager, Session, assemblyConfigSchema)
```

#### property: session

`session` encompasses the currently active state of the app, including views
open, tracks open in those views, etc.

```js
// type signature
IMaybe<ISnapshotProcessor<IModelType<{ name: ISimpleType<string>; margin: IType<number, number, number>; drawerWidth: IOptionalIType<ISimpleType<number>, [undefined]>; ... 7 more ...; drawerPosition: IOptionalIType<...>; }, { ...; } & ... 8 more ... & { ...; }, _NotCustomized, _NotCustomized>, _NotCustomized, _NotCu...
// code
session: types.maybe(Session)
```

#### property: jobsManager

```js
// type signature
IMaybe<IModelType<{}, { running: boolean; statusMessage: string; progressPct: number; jobName: string; controller: AbortController; jobsQueue: IObservableArray<TextJobsEntry>; finishedJobs: IObservableArray<...>; } & { ...; } & { ...; } & { ...; }, _NotCustomized, _NotCustomized>>
// code
jobsManager: types.maybe(JobsManager)
```

#### property: assemblyManager

```js
// type signature
IModelType<{ assemblies: IArrayType<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { error: unknown; loaded: boolean; loadingP: Promise<void>; volatileRegions: BasicRegion[]; refNameAliases: RefNameAliases; lowerCaseRefNameAliases: RefNameAliases; cytobands: Feature[]; } & ... 4 more ... & { ...; }...
// code
assemblyManager: assemblyManagerFactory(
        assemblyConfigSchema,
        pluginManager,
      )
```

#### property: savedSessionNames

```js
// type signature
IMaybe<IArrayType<ISimpleType<string>>>
// code
savedSessionNames: types.maybe(types.array(types.string))
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

#### property: sessionPath

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
sessionPath: types.optional(types.string, '')
```

#### property: history

used for undo/redo

```js
// type signature
IOptionalIType<IModelType<{ undoIdx: IType<number, number, number>; targetPath: IType<string, string, string>; }, { history: unknown[]; notTrackingUndo: boolean; } & { readonly canUndo: boolean; readonly canRedo: boolean; } & { ...; }, _NotCustomized, _NotCustomized>, [...]>
// code
history: types.optional(TimeTraveller, { targetPath: '../session' })
```

### JBrowseDesktopRootModel - Actions

#### action: saveSession

```js
// type signature
saveSession: (val: unknown) => Promise<void>
```

#### action: setOpenNewSessionCallback

```js
// type signature
setOpenNewSessionCallback: (cb: (arg: string) => Promise<void>) => void
```

#### action: setSavedSessionNames

```js
// type signature
setSavedSessionNames: (sessionNames: string[]) => void
```

#### action: setSessionPath

```js
// type signature
setSessionPath: (path: string) => void
```

#### action: setSession

```js
// type signature
setSession: (sessionSnapshot?: ModelCreationType<ExtractCFromProps<{ name: ISimpleType<string>; margin: IType<number, number, number>; drawerWidth: IOptionalIType<ISimpleType<number>, [undefined]>; ... 7 more ...; drawerPosition: IOptionalIType<...>; }>>) => void
```

#### action: setError

```js
// type signature
setError: (error: unknown) => void
```

#### action: setDefaultSession

```js
// type signature
setDefaultSession: () => void
```

#### action: setAssemblyEditing

```js
// type signature
setAssemblyEditing: (flag: boolean) => void
```

#### action: renameCurrentSession

```js
// type signature
renameCurrentSession: (newName: string) => Promise<void>
```

#### action: duplicateCurrentSession

```js
// type signature
duplicateCurrentSession: () => void
```

#### action: initializeInternetAccount

```js
// type signature
initializeInternetAccount: (
  internetAccountConfig: { [x: string]: any } & NonEmptyObject & {
      setSubschema(slotName: string, data: unknown): any,
    } & IStateTreeNode<AnyConfigurationSchemaType>,
  initialSnapshot?: {},
) => any
```

#### action: createEphemeralInternetAccount

```js
// type signature
createEphemeralInternetAccount: (
  internetAccountId: string,
  initialSnapshot: {},
  url: string,
) => any
```

#### action: findAppropriateInternetAccount

```js
// type signature
findAppropriateInternetAccount: (location: UriLocation) => any
```

#### action: activateSession

```js
// type signature
activateSession: (sessionSnapshot: ModelCreationType<ExtractCFromProps<{ name: ISimpleType<string>; margin: IType<number, number, number>; drawerWidth: IOptionalIType<ISimpleType<number>, [undefined]>; ... 7 more ...; drawerPosition: IOptionalIType<...>; }>>) => void
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
