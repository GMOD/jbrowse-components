---
id: jbrowsewebrootmodel
title: JBrowseWebRootModel
sidebar_label: Root -> JBrowseWebRootModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-web/src/rootModel/rootModel.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/JBrowseWebRootModel.md)

## Overview

note: many properties of the root model are available through the session, and
we generally prefer using the session model (via e.g. getSession) over the root
model (via e.g. getRoot) in plugin code

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

```js
// type signature
IMaybe<ISimpleType<string>>
// code
configPath: types.maybe(types.string)
```

</details>

<details>
<summary>JBrowseWebRootModel - Volatiles</summary>

#### volatile: adminMode

```js
// type signature
boolean
// code
adminMode
```

#### volatile: sessionDB

```js
// type signature
IDBPDatabase<SessionDB> | undefined
// code
sessionDB: undefined as IDBPDatabase<SessionDB> | undefined
```

#### volatile: version

```js
// type signature
string
// code
version: packageJSON.version
```

#### volatile: gitCommit

```js
// type signature
string
// code
gitCommit
```

#### volatile: pluginsUpdated

```js
// type signature
false
// code
pluginsUpdated: false
```

#### volatile: rpcManager

```js
// type signature
RpcManager
// code
rpcManager: new RpcManager(pluginManager, self.jbrowse.configuration.rpc, {
  makeWorkerInstance,
  defaultDriverName: 'WebWorkerRpcDriver',
})
```

#### volatile: savedSessionMetadata

```js
// type signature
SessionMetadata[] | undefined
// code
savedSessionMetadata: undefined as SessionMetadata[] | undefined
```

#### volatile: reloadPluginManagerCallback

```js
// type signature
(_configSnapshot: Record<string, unknown>, _sessionSnapshot: Record<string, unknown>) => void
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

```js
// type signature
menus: () => Menu[]
```

</details>

<details>
<summary>JBrowseWebRootModel - Actions</summary>

#### action: setSavedSessionMetadata

```js
// type signature
setSavedSessionMetadata: (sessions: SessionMetadata[]) => void
```

#### action: fetchSessionMetadata

```js
// type signature
fetchSessionMetadata: () => Promise<void>
```

#### action: setSessionDB

```js
// type signature
setSessionDB: (sessionDB: IDBPDatabase<SessionDB>) => void
```

#### action: setPluginsUpdated

```js
// type signature
setPluginsUpdated: () => void
```

#### action: setReloadPluginManagerCallback

```js
// type signature
setReloadPluginManagerCallback: (callback: (configSnapshot: Record<string, unknown>, sessionSnapshot: Record<string, unknown>) => void) => void
```

#### action: setDefaultSession

```js
// type signature
setDefaultSession: () => void
```

#### action: activateSession

```js
// type signature
activateSession: (id: string) => Promise<void>
```

#### action: setSavedSessionFavorite

```js
// type signature
setSavedSessionFavorite: (id: string, favorite: boolean) => Promise<void>
```

#### action: deleteSavedSession

```js
// type signature
deleteSavedSession: (id: string) => Promise<void>
```

#### action: renameSavedSession

```js
// type signature
renameSavedSession: (id: string, name: string) => Promise<void>
```

</details>
