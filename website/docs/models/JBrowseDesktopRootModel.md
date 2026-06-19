---
id: jbrowsedesktoprootmodel
title: JBrowseDesktopRootModel
sidebar_label: Root -> JBrowseDesktopRootModel
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
<summary>JBrowseDesktopRootModel - Properties</summary>

#### property: jobsManager

```js
// type signature
IOptionalIType<IModelType<{}, { running: boolean; statusMessage: string; jobName: string; stopToken: StopToken | undefined; aborted: boolean; jobsQueue: IObservableArray<TextJobsEntry>; } & { ...; } & { ...; } & { ...; }, _NotCustomized, _NotCustomized>, [...]>
// code
jobsManager: types.optional(JobsManager, {})
```

</details>

<details>
<summary>JBrowseDesktopRootModel - Volatiles</summary>

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

</details>

<details>
<summary>JBrowseDesktopRootModel - Methods</summary>

#### method: menus

```js
// type signature
menus: () => Menu[]
```

</details>

<details>
<summary>JBrowseDesktopRootModel - Actions</summary>

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

</details>
