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

<details open>
<summary>JBrowseWebRootModel - Properties</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                               | Signature                     |
| ------------------------------------ | ----------------------------- |
| [`configPath`](#property-configpath) | `IMaybe<ISimpleType<string>>` |

</details>

<details>
<summary>JBrowseWebRootModel - Properties (all signatures)</summary>

#### property: configPath

```ts
// type signature
type configPath = IMaybe<ISimpleType<string>>
// code
configPath: types.maybe(types.string)
```

</details>

<details open>
<summary>JBrowseWebRootModel - Volatiles</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                                 | Signature                                                                                       |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [`adminMode`](#volatile-adminmode)                                     | `boolean`                                                                                       |
| [`sessionDB`](#volatile-sessiondb)                                     | `IDBPDatabase<SessionDB> \| undefined`                                                          |
| [`version`](#volatile-version)                                         | `string`                                                                                        |
| [`gitCommit`](#volatile-gitcommit)                                     | `string`                                                                                        |
| [`pluginsUpdated`](#volatile-pluginsupdated)                           | `false`                                                                                         |
| [`rpcManager`](#volatile-rpcmanager)                                   | `RpcManager`                                                                                    |
| [`savedSessionMetadata`](#volatile-savedsessionmetadata)               | `SessionMetadata[] \| undefined`                                                                |
| [`reloadPluginManagerCallback`](#volatile-reloadpluginmanagercallback) | `(_configSnapshot: Record<string, unknown>, _sessionSnapshot: Record<string, unknown>) => void` |

</details>

<details>
<summary>JBrowseWebRootModel - Volatiles (all signatures)</summary>

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

<details open>
<summary>JBrowseWebRootModel - Methods</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                   | Signature      |
| ------------------------ | -------------- |
| [`menus`](#method-menus) | `() => Menu[]` |

</details>

<details>
<summary>JBrowseWebRootModel - Methods (all signatures)</summary>

#### method: menus

```ts
type menus = () => Menu[]
```

</details>

<details open>
<summary>JBrowseWebRootModel - Actions</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                                     | Signature                                                                                                         |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [`setSavedSessionMetadata`](#action-setsavedsessionmetadata)               | `(sessions: SessionMetadata[]) => void`                                                                           |
| [`fetchSessionMetadata`](#action-fetchsessionmetadata)                     | `() => Promise<void>`                                                                                             |
| [`setSessionDB`](#action-setsessiondb)                                     | `(sessionDB: IDBPDatabase<SessionDB>) => void`                                                                    |
| [`setPluginsUpdated`](#action-setpluginsupdated)                           | `() => void`                                                                                                      |
| [`setReloadPluginManagerCallback`](#action-setreloadpluginmanagercallback) | `(callback: (configSnapshot: Record<string, unknown>, sessionSnapshot: Record<string, unknown>) => void) => void` |
| [`setDefaultSession`](#action-setdefaultsession)                           | `() => void`                                                                                                      |
| [`activateSession`](#action-activatesession)                               | `(id: string) => Promise<void>`                                                                                   |
| [`setSavedSessionFavorite`](#action-setsavedsessionfavorite)               | `(id: string, favorite: boolean) => Promise<void>`                                                                |
| [`deleteSavedSession`](#action-deletesavedsession)                         | `(id: string) => Promise<void>`                                                                                   |
| [`renameSavedSession`](#action-renamesavedsession)                         | `(id: string, name: string) => Promise<void>`                                                                     |

</details>

<details>
<summary>JBrowseWebRootModel - Actions (all signatures)</summary>

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

#### action: setDefaultSession

```ts
type setDefaultSession = () => void
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
