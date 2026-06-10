---
id: jbrowsewebrootmodel
title: JBrowseWebRootModel
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

composed of

- [BaseRootModel](../baserootmodel)
- [InternetAccountsMixin](../internetaccountsmixin)
- [HistoryManagementMixin](../historymanagementmixin)
- [RootAppMenuMixin](../rootappmenumixin)

note: many properties of the root model are available through the session, and
we generally prefer using the session model (via e.g. getSession) over the root
model (via e.g. getRoot) in plugin code

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseRootModel](../baserootmodel)

**Properties:** jbrowse, session, sessionPath, assemblyManager

**Volatiles:** rpcManager, adminMode, error, textSearchManager, pluginManager

**Actions:** setError, setSession, setDefaultSession, setSessionPath,
renameCurrentSession

### Available via [InternetAccountsMixin](../internetaccountsmixin)

**Properties:** internetAccounts

**Actions:** initializeInternetAccount, createEphemeralInternetAccount,
findAppropriateInternetAccount

### Available via [HistoryManagementMixin](../historymanagementmixin)

**Properties:** history

### Available via [RootAppMenuMixin](../rootappmenumixin)

**Actions:** setMenus, appendMenu, insertMenu, appendToMenu, insertInMenu,
appendToSubMenu, insertInSubMenu

### JBrowseWebRootModel - Properties

#### property: configPath

```js
// type signature
IMaybe<ISimpleType<string>>
// code
configPath: types.maybe(types.string)
```

### JBrowseWebRootModel - Volatiles

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
version: `${packageJSON.version} (${process.env.BUILD_GIT_HASH ?? 'dev'})`
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

### JBrowseWebRootModel - Methods

#### method: menus

```js
// type signature
menus: () => Menu[]
```

### JBrowseWebRootModel - Actions

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
