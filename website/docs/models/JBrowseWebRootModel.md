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

| Member                                                                   | Kind       | Defined by                                          | Description                                                                                                         |
| ------------------------------------------------------------------------ | ---------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [configPath](#property-configpath)                                       | Properties | JBrowseWebRootModel                                 |                                                                                                                     |
| [adminMode](#volatile-adminmode)                                         | Volatiles  | JBrowseWebRootModel                                 |                                                                                                                     |
| [sessionDB](#volatile-sessiondb)                                         | Volatiles  | JBrowseWebRootModel                                 |                                                                                                                     |
| [version](#volatile-version)                                             | Volatiles  | JBrowseWebRootModel                                 |                                                                                                                     |
| [gitCommit](#volatile-gitcommit)                                         | Volatiles  | JBrowseWebRootModel                                 |                                                                                                                     |
| [pluginsUpdated](#volatile-pluginsupdated)                               | Volatiles  | JBrowseWebRootModel                                 |                                                                                                                     |
| [rpcManager](#volatile-rpcmanager)                                       | Volatiles  | JBrowseWebRootModel                                 |                                                                                                                     |
| [savedSessionMetadata](#volatile-savedsessionmetadata)                   | Volatiles  | JBrowseWebRootModel                                 |                                                                                                                     |
| [reloadPluginManagerCallback](#volatile-reloadpluginmanagercallback)     | Volatiles  | JBrowseWebRootModel                                 |                                                                                                                     |
| [menus](#method-menus)                                                   | Methods    | JBrowseWebRootModel                                 |                                                                                                                     |
| [setSavedSessionMetadata](#action-setsavedsessionmetadata)               | Actions    | JBrowseWebRootModel                                 |                                                                                                                     |
| [fetchSessionMetadata](#action-fetchsessionmetadata)                     | Actions    | JBrowseWebRootModel                                 |                                                                                                                     |
| [setSessionDB](#action-setsessiondb)                                     | Actions    | JBrowseWebRootModel                                 |                                                                                                                     |
| [setPluginsUpdated](#action-setpluginsupdated)                           | Actions    | JBrowseWebRootModel                                 |                                                                                                                     |
| [setReloadPluginManagerCallback](#action-setreloadpluginmanagercallback) | Actions    | JBrowseWebRootModel                                 |                                                                                                                     |
| [activateSession](#action-activatesession)                               | Actions    | JBrowseWebRootModel                                 |                                                                                                                     |
| [setSavedSessionFavorite](#action-setsavedsessionfavorite)               | Actions    | JBrowseWebRootModel                                 |                                                                                                                     |
| [deleteSavedSession](#action-deletesavedsession)                         | Actions    | JBrowseWebRootModel                                 |                                                                                                                     |
| [renameSavedSession](#action-renamesavedsession)                         | Actions    | JBrowseWebRootModel                                 |                                                                                                                     |
| [jbrowse](#property-jbrowse)                                             | Properties | [BaseRootModel](../baserootmodel)                   | `jbrowse` is a mapping of the config.json into the in-memory state tree                                             |
| [session](#property-session)                                             | Properties | [BaseRootModel](../baserootmodel)                   | `session` encompasses the currently active state of the app, including views open, tracks open in those views, etc. |
| [sessionPath](#property-sessionpath)                                     | Properties | [BaseRootModel](../baserootmodel)                   |                                                                                                                     |
| [assemblyManager](#property-assemblymanager)                             | Properties | [BaseRootModel](../baserootmodel)                   |                                                                                                                     |
| [error](#volatile-error)                                                 | Volatiles  | [BaseRootModel](../baserootmodel)                   |                                                                                                                     |
| [textSearchManager](#volatile-textsearchmanager)                         | Volatiles  | [BaseRootModel](../baserootmodel)                   |                                                                                                                     |
| [pluginManager](#volatile-pluginmanager)                                 | Volatiles  | [BaseRootModel](../baserootmodel)                   |                                                                                                                     |
| [setError](#action-seterror)                                             | Actions    | [BaseRootModel](../baserootmodel)                   |                                                                                                                     |
| [setSession](#action-setsession)                                         | Actions    | [BaseRootModel](../baserootmodel)                   | Sets the active session.                                                                                            |
| [setDefaultSession](#action-setdefaultsession)                           | Actions    | [BaseRootModel](../baserootmodel)                   |                                                                                                                     |
| [setSessionPath](#action-setsessionpath)                                 | Actions    | [BaseRootModel](../baserootmodel)                   |                                                                                                                     |
| [renameCurrentSession](#action-renamecurrentsession)                     | Actions    | [BaseRootModel](../baserootmodel)                   |                                                                                                                     |
| [internetAccounts](#property-internetaccounts)                           | Properties | [InternetAccountsMixin](../internetaccountsmixin)   |                                                                                                                     |
| [initializeInternetAccount](#action-initializeinternetaccount)           | Actions    | [InternetAccountsMixin](../internetaccountsmixin)   |                                                                                                                     |
| [createEphemeralInternetAccount](#action-createephemeralinternetaccount) | Actions    | [InternetAccountsMixin](../internetaccountsmixin)   |                                                                                                                     |
| [findAppropriateInternetAccount](#action-findappropriateinternetaccount) | Actions    | [InternetAccountsMixin](../internetaccountsmixin)   |                                                                                                                     |
| [history](#property-history)                                             | Properties | [HistoryManagementMixin](../historymanagementmixin) | used for undo/redo                                                                                                  |
| [mutableMenuActions](#volatile-mutablemenuactions)                       | Volatiles  | [RootAppMenuMixin](../rootappmenumixin)             |                                                                                                                     |
| [setMenus](#action-setmenus)                                             | Actions    | [RootAppMenuMixin](../rootappmenumixin)             |                                                                                                                     |
| [appendMenu](#action-appendmenu)                                         | Actions    | [RootAppMenuMixin](../rootappmenumixin)             | Add a top-level menu                                                                                                |
| [insertMenu](#action-insertmenu)                                         | Actions    | [RootAppMenuMixin](../rootappmenumixin)             | Insert a top-level menu                                                                                             |
| [appendToMenu](#action-appendtomenu)                                     | Actions    | [RootAppMenuMixin](../rootappmenumixin)             | Add a menu item to a top-level menu                                                                                 |
| [insertInMenu](#action-insertinmenu)                                     | Actions    | [RootAppMenuMixin](../rootappmenumixin)             | Insert a menu item into a top-level menu                                                                            |
| [appendToSubMenu](#action-appendtosubmenu)                               | Actions    | [RootAppMenuMixin](../rootappmenumixin)             | Add a menu item to a sub-menu                                                                                       |
| [insertInSubMenu](#action-insertinsubmenu)                               | Actions    | [RootAppMenuMixin](../rootappmenumixin)             | Insert a menu item into a sub-menu                                                                                  |

<details>
<summary>JBrowseWebRootModel - Properties</summary>

| Member                                           | Type                          |
| ------------------------------------------------ | ----------------------------- |
| <span id="property-configpath">configPath</span> | `IMaybe<ISimpleType<string>>` |

</details>

<details>
<summary>JBrowseWebRootModel - Volatiles</summary>

| Member                                                                             | Type                                                                                            |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| <span id="volatile-adminmode">adminMode</span>                                     | `boolean`                                                                                       |
| <span id="volatile-sessiondb">sessionDB</span>                                     | `IDBPDatabase<SessionDB> \| undefined`                                                          |
| <span id="volatile-version">version</span>                                         | `string`                                                                                        |
| <span id="volatile-gitcommit">gitCommit</span>                                     | `string`                                                                                        |
| <span id="volatile-pluginsupdated">pluginsUpdated</span>                           | `false`                                                                                         |
| <span id="volatile-rpcmanager">rpcManager</span>                                   | `RpcManager`                                                                                    |
| <span id="volatile-savedsessionmetadata">savedSessionMetadata</span>               | `SessionMetadata[] \| undefined`                                                                |
| <span id="volatile-reloadpluginmanagercallback">reloadPluginManagerCallback</span> | `(_configSnapshot: Record<string, unknown>, _sessionSnapshot: Record<string, unknown>) => void` |

</details>

<details>
<summary>JBrowseWebRootModel - Methods</summary>

| Member                               | Type           |
| ------------------------------------ | -------------- |
| <span id="method-menus">menus</span> | `() => Menu[]` |

</details>

<details>
<summary>JBrowseWebRootModel - Actions</summary>

| Member                                                                                 | Type                                                                                                              |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| <span id="action-setsavedsessionmetadata">setSavedSessionMetadata</span>               | `(sessions: SessionMetadata[]) => void`                                                                           |
| <span id="action-fetchsessionmetadata">fetchSessionMetadata</span>                     | `() => Promise<void>`                                                                                             |
| <span id="action-setsessiondb">setSessionDB</span>                                     | `(sessionDB: IDBPDatabase<SessionDB>) => void`                                                                    |
| <span id="action-setpluginsupdated">setPluginsUpdated</span>                           | `() => void`                                                                                                      |
| <span id="action-setreloadpluginmanagercallback">setReloadPluginManagerCallback</span> | `(callback: (configSnapshot: Record<string, unknown>, sessionSnapshot: Record<string, unknown>) => void) => void` |
| <span id="action-activatesession">activateSession</span>                               | `(id: string) => Promise<void>`                                                                                   |
| <span id="action-setsavedsessionfavorite">setSavedSessionFavorite</span>               | `(id: string, favorite: boolean) => Promise<void>`                                                                |
| <span id="action-deletesavedsession">deleteSavedSession</span>                         | `(id: string) => Promise<void>`                                                                                   |
| <span id="action-renamesavedsession">renameSavedSession</span>                         | `(id: string, name: string) => Promise<void>`                                                                     |

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

| Member                                                     | Type                                               |
| ---------------------------------------------------------- | -------------------------------------------------- |
| <span id="property-sessionpath">sessionPath</span>         | `IOptionalIType<ISimpleType<string>, [undefined]>` |
| <span id="property-assemblymanager">assemblyManager</span> | `IOptionalIType<IModelType<…>, [undefined]>`       |

**Volatiles**

| Member                                                         | Type                |
| -------------------------------------------------------------- | ------------------- |
| <span id="volatile-error">error</span>                         | `unknown`           |
| <span id="volatile-textsearchmanager">textSearchManager</span> | `TextSearchManager` |
| <span id="volatile-pluginmanager">pluginManager</span>         | `PluginManager`     |

**Actions**

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

| Member                                                             | Type                        |
| ------------------------------------------------------------------ | --------------------------- |
| <span id="action-seterror">setError</span>                         | `(error: unknown) => void`  |
| <span id="action-setdefaultsession">setDefaultSession</span>       | `() => void`                |
| <span id="action-setsessionpath">setSessionPath</span>             | `(path: string) => void`    |
| <span id="action-renamecurrentsession">renameCurrentSession</span> | `(newName: string) => void` |

</details>

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

<details>
<summary>Derived from HistoryManagementMixin</summary>

[HistoryManagementMixin →](../historymanagementmixin)

**Properties**

#### property: history

used for undo/redo

```ts
// type signature
type history = IOptionalIType<IModelType<…>, [...]>
// code
history: types.optional(TimeTraveller, { targetPath: '../session' })
```

</details>

<details>
<summary>Derived from RootAppMenuMixin</summary>

[RootAppMenuMixin →](../rootappmenumixin)

**Volatiles**

| Member                                                           | Type           |
| ---------------------------------------------------------------- | -------------- |
| <span id="volatile-mutablemenuactions">mutableMenuActions</span> | `MenuAction[]` |

**Actions**

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

| Member                                     | Type                         |
| ------------------------------------------ | ---------------------------- |
| <span id="action-setmenus">setMenus</span> | `(newMenus: Menu[]) => void` |

</details>
