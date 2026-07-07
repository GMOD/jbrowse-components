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

| Member                                                                   | Kind       | Description |
| ------------------------------------------------------------------------ | ---------- | ----------- |
| [configPath](#property-configpath)                                       | Properties |             |
| [adminMode](#volatile-adminmode)                                         | Volatiles  |             |
| [sessionDB](#volatile-sessiondb)                                         | Volatiles  |             |
| [version](#volatile-version)                                             | Volatiles  |             |
| [gitCommit](#volatile-gitcommit)                                         | Volatiles  |             |
| [pluginsUpdated](#volatile-pluginsupdated)                               | Volatiles  |             |
| [rpcManager](#volatile-rpcmanager)                                       | Volatiles  |             |
| [savedSessionMetadata](#volatile-savedsessionmetadata)                   | Volatiles  |             |
| [reloadPluginManagerCallback](#volatile-reloadpluginmanagercallback)     | Volatiles  |             |
| [menus](#method-menus)                                                   | Methods    |             |
| [setSavedSessionMetadata](#action-setsavedsessionmetadata)               | Actions    |             |
| [fetchSessionMetadata](#action-fetchsessionmetadata)                     | Actions    |             |
| [setSessionDB](#action-setsessiondb)                                     | Actions    |             |
| [setPluginsUpdated](#action-setpluginsupdated)                           | Actions    |             |
| [setReloadPluginManagerCallback](#action-setreloadpluginmanagercallback) | Actions    |             |
| [activateSession](#action-activatesession)                               | Actions    |             |
| [setSavedSessionFavorite](#action-setsavedsessionfavorite)               | Actions    |             |
| [deleteSavedSession](#action-deletesavedsession)                         | Actions    |             |
| [renameSavedSession](#action-renamesavedsession)                         | Actions    |             |

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseRootModel](../baserootmodel)

**Properties:** [jbrowse](../baserootmodel#property-jbrowse),
[session](../baserootmodel#property-session),
[sessionPath](../baserootmodel#property-sessionpath),
[assemblyManager](../baserootmodel#property-assemblymanager)

**Volatiles:** [rpcManager](../baserootmodel#volatile-rpcmanager),
[adminMode](../baserootmodel#volatile-adminmode),
[error](../baserootmodel#volatile-error),
[textSearchManager](../baserootmodel#volatile-textsearchmanager),
[pluginManager](../baserootmodel#volatile-pluginmanager)

**Actions:** [setError](../baserootmodel#action-seterror),
[setSession](../baserootmodel#action-setsession),
[setDefaultSession](../baserootmodel#action-setdefaultsession),
[setSessionPath](../baserootmodel#action-setsessionpath),
[renameCurrentSession](../baserootmodel#action-renamecurrentsession)

### Available via [InternetAccountsMixin](../internetaccountsmixin)

**Properties:**
[internetAccounts](../internetaccountsmixin#property-internetaccounts)

**Actions:**
[initializeInternetAccount](../internetaccountsmixin#action-initializeinternetaccount),
[createEphemeralInternetAccount](../internetaccountsmixin#action-createephemeralinternetaccount),
[findAppropriateInternetAccount](../internetaccountsmixin#action-findappropriateinternetaccount)

### Available via [HistoryManagementMixin](../historymanagementmixin)

**Properties:** [history](../historymanagementmixin#property-history)

### Available via [RootAppMenuMixin](../rootappmenumixin)

**Volatiles:**
[mutableMenuActions](../rootappmenumixin#volatile-mutablemenuactions)

**Actions:** [setMenus](../rootappmenumixin#action-setmenus),
[appendMenu](../rootappmenumixin#action-appendmenu),
[insertMenu](../rootappmenumixin#action-insertmenu),
[appendToMenu](../rootappmenumixin#action-appendtomenu),
[insertInMenu](../rootappmenumixin#action-insertinmenu),
[appendToSubMenu](../rootappmenumixin#action-appendtosubmenu),
[insertInSubMenu](../rootappmenumixin#action-insertinsubmenu)

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
