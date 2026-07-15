---
id: jbrowsewebrootmodel
title: JBrowseWebRootModel
sidebar_label: Root -> JBrowseWebRootModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-web/src/rootModel/rootModel.ts).

## Overview

note: many properties of the root model are available through the session, and
we generally prefer using the session model (via e.g. getSession) over the root
model (via e.g. getRoot) in plugin code

## Members

| Member                                                                   | Kind       | Defined by                                          | Description                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------ | ---------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [configPath](#property-configpath)                                       | Properties | JBrowseWebRootModel                                 |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [adminMode](#volatile-adminmode)                                         | Volatiles  | JBrowseWebRootModel                                 |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [sessionDB](#volatile-sessiondb)                                         | Volatiles  | JBrowseWebRootModel                                 |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [version](#volatile-version)                                             | Volatiles  | JBrowseWebRootModel                                 |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [gitCommit](#volatile-gitcommit)                                         | Volatiles  | JBrowseWebRootModel                                 |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [pluginsUpdated](#volatile-pluginsupdated)                               | Volatiles  | JBrowseWebRootModel                                 |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [rpcManager](#volatile-rpcmanager)                                       | Volatiles  | JBrowseWebRootModel                                 |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [savedSessionMetadata](#volatile-savedsessionmetadata)                   | Volatiles  | JBrowseWebRootModel                                 |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [reloadPluginManagerCallback](#volatile-reloadpluginmanagercallback)     | Volatiles  | JBrowseWebRootModel                                 |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [menus](#method-menus)                                                   | Methods    | JBrowseWebRootModel                                 |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setSavedSessionMetadata](#action-setsavedsessionmetadata)               | Actions    | JBrowseWebRootModel                                 |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [fetchSessionMetadata](#action-fetchsessionmetadata)                     | Actions    | JBrowseWebRootModel                                 |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setSessionDB](#action-setsessiondb)                                     | Actions    | JBrowseWebRootModel                                 |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setPluginsUpdated](#action-setpluginsupdated)                           | Actions    | JBrowseWebRootModel                                 |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setReloadPluginManagerCallback](#action-setreloadpluginmanagercallback) | Actions    | JBrowseWebRootModel                                 |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [activateSession](#action-activatesession)                               | Actions    | JBrowseWebRootModel                                 |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setSavedSessionFavorite](#action-setsavedsessionfavorite)               | Actions    | JBrowseWebRootModel                                 |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [deleteSavedSession](#action-deletesavedsession)                         | Actions    | JBrowseWebRootModel                                 |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [renameSavedSession](#action-renamesavedsession)                         | Actions    | JBrowseWebRootModel                                 |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [jbrowse](#property-jbrowse)                                             | Properties | [BaseRootModel](../baserootmodel)                   | `jbrowse` is a mapping of the config.json into the in-memory state tree                                                                                                                                                                                                                                                                                                                         |
| [session](#property-session)                                             | Properties | [BaseRootModel](../baserootmodel)                   | `session` encompasses the currently active state of the app, including views open, tracks open in those views, etc.                                                                                                                                                                                                                                                                             |
| [sessionPath](#property-sessionpath)                                     | Properties | [BaseRootModel](../baserootmodel)                   |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [assemblyManager](#property-assemblymanager)                             | Properties | [BaseRootModel](../baserootmodel)                   |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [error](#volatile-error)                                                 | Volatiles  | [BaseRootModel](../baserootmodel)                   |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [textSearchManager](#volatile-textsearchmanager)                         | Volatiles  | [BaseRootModel](../baserootmodel)                   |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [pluginManager](#volatile-pluginmanager)                                 | Volatiles  | [BaseRootModel](../baserootmodel)                   |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setError](#action-seterror)                                             | Actions    | [BaseRootModel](../baserootmodel)                   |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setSession](#action-setsession)                                         | Actions    | [BaseRootModel](../baserootmodel)                   | Sets the active session. Remaps any legacy display type names (e.g. LinearPileupDisplay → LinearAlignmentsDisplay), then walks the resulting MST tree to drop open tracks whose config can't hydrate so shared sessions still load when referencing tracks that no longer exist. Dropped tracks are surfaced to the user via a snackbar. If filtering throws, the previous session is restored. |
| [setDefaultSession](#action-setdefaultsession)                           | Actions    | [BaseRootModel](../baserootmodel)                   |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setSessionPath](#action-setsessionpath)                                 | Actions    | [BaseRootModel](../baserootmodel)                   |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [renameCurrentSession](#action-renamecurrentsession)                     | Actions    | [BaseRootModel](../baserootmodel)                   |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [internetAccounts](#property-internetaccounts)                           | Properties | [InternetAccountsMixin](../internetaccountsmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [initializeInternetAccount](#action-initializeinternetaccount)           | Actions    | [InternetAccountsMixin](../internetaccountsmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [createEphemeralInternetAccount](#action-createephemeralinternetaccount) | Actions    | [InternetAccountsMixin](../internetaccountsmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [findAppropriateInternetAccount](#action-findappropriateinternetaccount) | Actions    | [InternetAccountsMixin](../internetaccountsmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [history](#property-history)                                             | Properties | [HistoryManagementMixin](../historymanagementmixin) | used for undo/redo                                                                                                                                                                                                                                                                                                                                                                              |
| [mutableMenuActions](#volatile-mutablemenuactions)                       | Volatiles  | [RootAppMenuMixin](../rootappmenumixin)             |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setMenus](#action-setmenus)                                             | Actions    | [RootAppMenuMixin](../rootappmenumixin)             |                                                                                                                                                                                                                                                                                                                                                                                                 |
| [appendMenu](#action-appendmenu)                                         | Actions    | [RootAppMenuMixin](../rootappmenumixin)             | Add a top-level menu                                                                                                                                                                                                                                                                                                                                                                            |
| [insertMenu](#action-insertmenu)                                         | Actions    | [RootAppMenuMixin](../rootappmenumixin)             | Insert a top-level menu                                                                                                                                                                                                                                                                                                                                                                         |
| [appendToMenu](#action-appendtomenu)                                     | Actions    | [RootAppMenuMixin](../rootappmenumixin)             | Add a menu item to a top-level menu                                                                                                                                                                                                                                                                                                                                                             |
| [insertInMenu](#action-insertinmenu)                                     | Actions    | [RootAppMenuMixin](../rootappmenumixin)             | Insert a menu item into a top-level menu                                                                                                                                                                                                                                                                                                                                                        |
| [appendToSubMenu](#action-appendtosubmenu)                               | Actions    | [RootAppMenuMixin](../rootappmenumixin)             | Add a menu item to a sub-menu                                                                                                                                                                                                                                                                                                                                                                   |
| [insertInSubMenu](#action-insertinsubmenu)                               | Actions    | [RootAppMenuMixin](../rootappmenumixin)             | Insert a menu item into a sub-menu                                                                                                                                                                                                                                                                                                                                                              |

<details>
<summary>JBrowseWebRootModel - Properties</summary>

#### property: configPath

```ts
// type signature
type configPath = IMaybe<ISimpleType<string>>
// code
configPath: types.maybe(types.string)
```

</details>

<details>
<summary>JBrowseWebRootModel - Volatiles</summary>

#### volatile: adminMode

```ts
// type signature
type adminMode = boolean
// code
adminMode
```

#### volatile: sessionDB

```ts
// type signature
type sessionDB = IDBPDatabase<SessionDB> | undefined
// code
sessionDB: undefined as IDBPDatabase<SessionDB> | undefined
```

#### volatile: version

```ts
// type signature
type version = string
// code
version: packageJSON.version
```

#### volatile: gitCommit

```ts
// type signature
type gitCommit = string
// code
gitCommit
```

#### volatile: pluginsUpdated

```ts
// type signature
type pluginsUpdated = false
// code
pluginsUpdated: false
```

#### volatile: rpcManager

```ts
// type signature
type rpcManager = RpcManager
// code
rpcManager: new RpcManager(pluginManager, self.jbrowse.configuration.rpc, {
  makeWorkerInstance,
  defaultDriverName: 'WebWorkerRpcDriver',
})
```

#### volatile: savedSessionMetadata

```ts
// type signature
type savedSessionMetadata = SessionMetadata[] | undefined
// code
savedSessionMetadata: undefined as SessionMetadata[] | undefined
```

#### volatile: reloadPluginManagerCallback

```ts
// type signature
type reloadPluginManagerCallback = (
  _configSnapshot: Record<string, unknown>,
  _sessionSnapshot: Record<string, unknown>,
) => void
// code
reloadPluginManagerCallback: (
  _configSnapshot: Record<string, unknown>,
  _sessionSnapshot: Record<string, unknown>,
) => {
  console.error('reloadPluginManagerCallback unimplemented')
}
```

</details>

<details>
<summary>JBrowseWebRootModel - Methods</summary>

#### method: menus

```ts
type menus = () => Menu[]
```

</details>

<details>
<summary>JBrowseWebRootModel - Actions</summary>

#### action: setSavedSessionMetadata

```ts
type setSavedSessionMetadata = (sessions: SessionMetadata[]) => void
```

#### action: fetchSessionMetadata

```ts
type fetchSessionMetadata = () => Promise<void>
```

#### action: setSessionDB

```ts
type setSessionDB = (sessionDB: IDBPDatabase<SessionDB>) => void
```

#### action: setPluginsUpdated

```ts
type setPluginsUpdated = () => void
```

#### action: setReloadPluginManagerCallback

```ts
type setReloadPluginManagerCallback = (
  callback: (
    configSnapshot: Record<string, unknown>,
    sessionSnapshot: Record<string, unknown>,
  ) => void,
) => void
```

#### action: activateSession

```ts
type activateSession = (id: string) => Promise<void>
```

#### action: setSavedSessionFavorite

```ts
type setSavedSessionFavorite = (id: string, favorite: boolean) => Promise<void>
```

#### action: deleteSavedSession

```ts
type deleteSavedSession = (id: string) => Promise<void>
```

#### action: renameSavedSession

```ts
type renameSavedSession = (id: string, name: string) => Promise<void>
```

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from BaseRootModel</summary>

[BaseRootModel →](../baserootmodel)

**Properties**

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

#### property: sessionPath

```ts
// type signature
type sessionPath = IOptionalIType<ISimpleType<string>, [undefined]>
// code
sessionPath: types.stripDefault(types.string, '')
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

**Volatiles**

#### volatile: error

```ts
// type signature
type error = unknown
// code
error: undefined as unknown
```

#### volatile: textSearchManager

```ts
// type signature
type textSearchManager = TextSearchManager
// code
textSearchManager: new TextSearchManager(pluginManager)
```

#### volatile: pluginManager

```ts
// type signature
type pluginManager = PluginManager
// code
pluginManager
```

**Actions**

#### action: setError

```ts
type setError = (error: unknown) => void
```

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

#### action: setDefaultSession

```ts
type setDefaultSession = () => void
```

#### action: setSessionPath

```ts
type setSessionPath = (path: string) => void
```

#### action: renameCurrentSession

```ts
type renameCurrentSession = (newName: string) => void
```

</details>

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

<details>
<summary>Derived from HistoryManagementMixin</summary>

[HistoryManagementMixin →](../historymanagementmixin)

**Properties**

#### property: history

used for undo/redo

```ts
// type signature
type history = IOptionalIType<IModelType<{ undoIdx: IType<number | undefined, number, number>; targetPath: IType<string | undefined, string, string>; }, { history: unknown[]; notTrackingUndo: boolean; } & { ...; } & { ...; }, _NotCustomized, _NotCustomized>, [...]>
// code
history: types.optional(TimeTraveller, { targetPath: '../session' })
```

</details>

<details>
<summary>Derived from RootAppMenuMixin</summary>

[RootAppMenuMixin →](../rootappmenumixin)

**Volatiles**

#### volatile: mutableMenuActions

```ts
// type signature
type mutableMenuActions = MenuAction[]
// code
mutableMenuActions: [] as MenuAction[]
```

**Actions**

#### action: setMenus

```ts
type setMenus = (newMenus: Menu[]) => void
```

#### action: appendMenu

Add a top-level menu

```ts
type appendMenu = (menuName: string) => void
```

#### action: insertMenu

Insert a top-level menu

```ts
type insertMenu = (menuName: string, position: number) => void
```

#### action: appendToMenu

Add a menu item to a top-level menu

```ts
type appendToMenu = (menuName: string, menuItem: MenuItem) => void
```

#### action: insertInMenu

Insert a menu item into a top-level menu

```ts
type insertInMenu = (
  menuName: string,
  menuItem: MenuItem,
  position: number,
) => void
```

#### action: appendToSubMenu

Add a menu item to a sub-menu

```ts
type appendToSubMenu = (menuPath: string[], menuItem: MenuItem) => void
```

#### action: insertInSubMenu

Insert a menu item into a sub-menu

```ts
type insertInSubMenu = (
  menuPath: string[],
  menuItem: MenuItem,
  position: number,
) => void
```

</details>
