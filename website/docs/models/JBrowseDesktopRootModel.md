---
id: jbrowsedesktoprootmodel
title: JBrowseDesktopRootModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-desktop/src/rootModel/rootModel.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/JBrowseDesktopRootModel.md)

## Overview

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

**Volatiles:** mutableMenuActions

**Actions:** setMenus, appendMenu, insertMenu, appendToMenu, insertInMenu,
appendToSubMenu, insertInSubMenu

### JBrowseDesktopRootModel - Properties

#### property: jobsManager

```js
// type signature
IOptionalIType<IModelType<{}, { running: boolean; statusMessage: string; jobName: string; stopToken: StopToken | undefined; aborted: boolean; jobsQueue: IObservableArray<TextJobsEntry>; finishedJobs: IObservableArray<...>; } & { ...; } & { ...; } & { ...; }, _NotCustomized, _NotCustomized>, [...]>
// code
jobsManager: types.optional(JobsManager, {})
```

### JBrowseDesktopRootModel - Volatiles

#### volatile: version

```js
// type signature
string
// code
version: packageJSON.version
```

#### volatile: adminMode

```js
// type signature
true
// code
adminMode: true
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

#### volatile: openNewSessionCallback

```js
// type signature
(_path: string) => Promise<void>
// code
openNewSessionCallback: async (_path: string) => {
          console.error('openNewSessionCallback unimplemented')
        }
```

### JBrowseDesktopRootModel - Methods

#### method: menus

```js
// type signature
menus: () => Menu[]
```

### JBrowseDesktopRootModel - Actions

#### action: setOpenNewSessionCallback

```js
// type signature
setOpenNewSessionCallback: (cb: (arg: string) => Promise<void>) => void
```

#### action: saveSession

```js
// type signature
saveSession: (val: unknown) => Promise<void>
```

#### action: setPluginsUpdated

Persist the session, then rebuild the plugin manager from disk so the changed
plugin set takes effect (Loader wires openNewSessionCallback to reload from the
session path).

```js
// type signature
setPluginsUpdated: () => Promise<void>
```
