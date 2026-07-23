---
id: jbrowsedesktoprootmodel
title: JBrowseDesktopRootModel
sidebar_label: Root -> JBrowseDesktopRootModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-desktop/src/rootModel/rootModel.ts).

## Overview

note: many properties of the root model are available through the session, and
we generally prefer using the session model (via e.g. getSession) over the root
model (via e.g. getRoot) in plugin code

## Members

| Member                                                                   | Kind       | Defined by                                          | Description                                                                                                                                                                  |
| ------------------------------------------------------------------------ | ---------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [jobsManager](#property-jobsmanager)                                     | Properties | JBrowseDesktopRootModel                             |                                                                                                                                                                              |
| [version](#volatile-version)                                             | Volatiles  | JBrowseDesktopRootModel                             |                                                                                                                                                                              |
| [adminMode](#volatile-adminmode)                                         | Volatiles  | JBrowseDesktopRootModel                             |                                                                                                                                                                              |
| [rpcManager](#volatile-rpcmanager)                                       | Volatiles  | JBrowseDesktopRootModel                             |                                                                                                                                                                              |
| [openNewSessionCallback](#volatile-opennewsessioncallback)               | Volatiles  | JBrowseDesktopRootModel                             |                                                                                                                                                                              |
| [openLinkCallback](#volatile-openlinkcallback)                           | Volatiles  | JBrowseDesktopRootModel                             |                                                                                                                                                                              |
| [returnToStartScreenCallback](#volatile-returntostartscreencallback)     | Volatiles  | JBrowseDesktopRootModel                             |                                                                                                                                                                              |
| [menus](#method-menus)                                                   | Methods    | JBrowseDesktopRootModel                             |                                                                                                                                                                              |
| [setOpenNewSessionCallback](#action-setopennewsessioncallback)           | Actions    | JBrowseDesktopRootModel                             |                                                                                                                                                                              |
| [setOpenLinkCallback](#action-setopenlinkcallback)                       | Actions    | JBrowseDesktopRootModel                             | Wired by the Loader to open a JBrowse Web link as a new session (the Loader owns plugin-manager lifecycle, as with openNewSessionCallback).                                  |
| [setReturnToStartScreenCallback](#action-setreturntostartscreencallback) | Actions    | JBrowseDesktopRootModel                             | Wired by the Loader to tear down this plugin manager and show the start screen (the Loader owns plugin-manager lifecycle).                                                   |
| [saveSession](#action-savesession)                                       | Actions    | JBrowseDesktopRootModel                             |                                                                                                                                                                              |
| [setPluginsUpdated](#action-setpluginsupdated)                           | Actions    | JBrowseDesktopRootModel                             | Persist the session, then rebuild the plugin manager from disk so the changed plugin set takes effect (Loader wires openNewSessionCallback to reload from the session path). |
| [jbrowse](#property-jbrowse)                                             | Properties | [BaseRootModel](../baserootmodel)                   | `jbrowse` is a mapping of the config.json into the in-memory state tree                                                                                                      |
| [session](#property-session)                                             | Properties | [BaseRootModel](../baserootmodel)                   | `session` encompasses the currently active state of the app, including views open, tracks open in those views, etc.                                                          |
| [sessionPath](#property-sessionpath)                                     | Properties | [BaseRootModel](../baserootmodel)                   |                                                                                                                                                                              |
| [assemblyManager](#property-assemblymanager)                             | Properties | [BaseRootModel](../baserootmodel)                   |                                                                                                                                                                              |
| [error](#volatile-error)                                                 | Volatiles  | [BaseRootModel](../baserootmodel)                   |                                                                                                                                                                              |
| [textSearchManager](#volatile-textsearchmanager)                         | Volatiles  | [BaseRootModel](../baserootmodel)                   |                                                                                                                                                                              |
| [pluginManager](#volatile-pluginmanager)                                 | Volatiles  | [BaseRootModel](../baserootmodel)                   |                                                                                                                                                                              |
| [setError](#action-seterror)                                             | Actions    | [BaseRootModel](../baserootmodel)                   |                                                                                                                                                                              |
| [setSession](#action-setsession)                                         | Actions    | [BaseRootModel](../baserootmodel)                   | Sets the active session.                                                                                                                                                     |
| [setDefaultSession](#action-setdefaultsession)                           | Actions    | [BaseRootModel](../baserootmodel)                   |                                                                                                                                                                              |
| [setSessionPath](#action-setsessionpath)                                 | Actions    | [BaseRootModel](../baserootmodel)                   |                                                                                                                                                                              |
| [renameCurrentSession](#action-renamecurrentsession)                     | Actions    | [BaseRootModel](../baserootmodel)                   |                                                                                                                                                                              |
| [internetAccounts](#property-internetaccounts)                           | Properties | [InternetAccountsMixin](../internetaccountsmixin)   |                                                                                                                                                                              |
| [initializeInternetAccount](#action-initializeinternetaccount)           | Actions    | [InternetAccountsMixin](../internetaccountsmixin)   |                                                                                                                                                                              |
| [createEphemeralInternetAccount](#action-createephemeralinternetaccount) | Actions    | [InternetAccountsMixin](../internetaccountsmixin)   |                                                                                                                                                                              |
| [findAppropriateInternetAccount](#action-findappropriateinternetaccount) | Actions    | [InternetAccountsMixin](../internetaccountsmixin)   |                                                                                                                                                                              |
| [history](#property-history)                                             | Properties | [HistoryManagementMixin](../historymanagementmixin) | used for undo/redo                                                                                                                                                           |
| [mutableMenuActions](#volatile-mutablemenuactions)                       | Volatiles  | [RootAppMenuMixin](../rootappmenumixin)             |                                                                                                                                                                              |
| [setMenus](#action-setmenus)                                             | Actions    | [RootAppMenuMixin](../rootappmenumixin)             |                                                                                                                                                                              |
| [appendMenu](#action-appendmenu)                                         | Actions    | [RootAppMenuMixin](../rootappmenumixin)             | Add a top-level menu                                                                                                                                                         |
| [insertMenu](#action-insertmenu)                                         | Actions    | [RootAppMenuMixin](../rootappmenumixin)             | Insert a top-level menu                                                                                                                                                      |
| [appendToMenu](#action-appendtomenu)                                     | Actions    | [RootAppMenuMixin](../rootappmenumixin)             | Add a menu item to a top-level menu                                                                                                                                          |
| [insertInMenu](#action-insertinmenu)                                     | Actions    | [RootAppMenuMixin](../rootappmenumixin)             | Insert a menu item into a top-level menu                                                                                                                                     |
| [appendToSubMenu](#action-appendtosubmenu)                               | Actions    | [RootAppMenuMixin](../rootappmenumixin)             | Add a menu item to a sub-menu                                                                                                                                                |
| [insertInSubMenu](#action-insertinsubmenu)                               | Actions    | [RootAppMenuMixin](../rootappmenumixin)             | Insert a menu item into a sub-menu                                                                                                                                           |

<details>
<summary>JBrowseDesktopRootModel - Properties</summary>

| Member                                             | Type                                   |
| -------------------------------------------------- | -------------------------------------- |
| <span id="property-jobsmanager">jobsManager</span> | `IOptionalIType<IModelType<…>, [...]>` |

</details>

<details>
<summary>JBrowseDesktopRootModel - Volatiles</summary>

| Member                                                                             | Type                               |
| ---------------------------------------------------------------------------------- | ---------------------------------- |
| <span id="volatile-version">version</span>                                         | `string`                           |
| <span id="volatile-adminmode">adminMode</span>                                     | `true`                             |
| <span id="volatile-rpcmanager">rpcManager</span>                                   | `RpcManager`                       |
| <span id="volatile-opennewsessioncallback">openNewSessionCallback</span>           | `(_path: string) => Promise<void>` |
| <span id="volatile-openlinkcallback">openLinkCallback</span>                       | `(_link: string) => Promise<void>` |
| <span id="volatile-returntostartscreencallback">returnToStartScreenCallback</span> | `() => void`                       |

</details>

<details>
<summary>JBrowseDesktopRootModel - Methods</summary>

| Member                               | Type           |
| ------------------------------------ | -------------- |
| <span id="method-menus">menus</span> | `() => Menu[]` |

</details>

<details>
<summary>JBrowseDesktopRootModel - Actions</summary>

#### action: setOpenLinkCallback

Wired by the Loader to open a JBrowse Web link as a new session (the Loader owns
plugin-manager lifecycle, as with openNewSessionCallback).

```ts
type setOpenLinkCallback = (cb: (arg: string) => Promise<void>) => void
```

#### action: setReturnToStartScreenCallback

Wired by the Loader to tear down this plugin manager and show the start screen
(the Loader owns plugin-manager lifecycle).

```ts
type setReturnToStartScreenCallback = (cb: () => void) => void
```

#### action: setPluginsUpdated

Persist the session, then rebuild the plugin manager from disk so the changed
plugin set takes effect (Loader wires openNewSessionCallback to reload from the
session path).

```ts
type setPluginsUpdated = () => Promise<void>
```

</details>

<details>
<summary>JBrowseDesktopRootModel - Actions (other undocumented members)</summary>

| Member                                                                       | Type                                           |
| ---------------------------------------------------------------------------- | ---------------------------------------------- |
| <span id="action-setopennewsessioncallback">setOpenNewSessionCallback</span> | `(cb: (arg: string) => Promise<void>) => void` |
| <span id="action-savesession">saveSession</span>                             | `(val: unknown) => Promise<void>`              |

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
