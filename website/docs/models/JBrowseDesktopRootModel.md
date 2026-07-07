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

| Member                                                                   | Kind       | Description                                                                                                                                                                  |
| ------------------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [jobsManager](#property-jobsmanager)                                     | Properties |                                                                                                                                                                              |
| [version](#volatile-version)                                             | Volatiles  |                                                                                                                                                                              |
| [adminMode](#volatile-adminmode)                                         | Volatiles  |                                                                                                                                                                              |
| [rpcManager](#volatile-rpcmanager)                                       | Volatiles  |                                                                                                                                                                              |
| [openNewSessionCallback](#volatile-opennewsessioncallback)               | Volatiles  |                                                                                                                                                                              |
| [returnToStartScreenCallback](#volatile-returntostartscreencallback)     | Volatiles  |                                                                                                                                                                              |
| [menus](#method-menus)                                                   | Methods    |                                                                                                                                                                              |
| [setOpenNewSessionCallback](#action-setopennewsessioncallback)           | Actions    |                                                                                                                                                                              |
| [setReturnToStartScreenCallback](#action-setreturntostartscreencallback) | Actions    | Wired by the Loader to tear down this plugin manager and show the start screen (the Loader owns plugin-manager lifecycle).                                                   |
| [saveSession](#action-savesession)                                       | Actions    |                                                                                                                                                                              |
| [setPluginsUpdated](#action-setpluginsupdated)                           | Actions    | Persist the session, then rebuild the plugin manager from disk so the changed plugin set takes effect (Loader wires openNewSessionCallback to reload from the session path). |

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

```ts
// type signature
type jobsManager = IOptionalIType<IModelType<{}, { running: boolean; statusMessage: string; jobName: string; stopToken: StopToken | undefined; aborted: boolean; jobsQueue: IObservableArray<TextJobsEntry>; } & { ...; } & { ...; } & { ...; }, _NotCustomized, _NotCustomized>, [...]>
// code
jobsManager: types.optional(JobsManager, {})
```

</details>

<details>
<summary>JBrowseDesktopRootModel - Volatiles</summary>

#### volatile: version

```ts
// type signature
type version = string
// code
version: packageJSON.version
```

#### volatile: adminMode

```ts
// type signature
type adminMode = true
// code
adminMode: true
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

#### volatile: openNewSessionCallback

```ts
// type signature
type openNewSessionCallback = (_path: string) => Promise<void>
// code
openNewSessionCallback: async (_path: string) => {
  console.error('openNewSessionCallback unimplemented')
}
```

#### volatile: returnToStartScreenCallback

```ts
// type signature
type returnToStartScreenCallback = () => void
// code
returnToStartScreenCallback: () => {
  console.error('returnToStartScreenCallback unimplemented')
}
```

</details>

<details>
<summary>JBrowseDesktopRootModel - Methods</summary>

#### method: menus

```ts
type menus = () => Menu[]
```

</details>

<details>
<summary>JBrowseDesktopRootModel - Actions</summary>

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

#### action: setOpenNewSessionCallback

```ts
type setOpenNewSessionCallback = (cb: (arg: string) => Promise<void>) => void
```

#### action: saveSession

```ts
type saveSession = (val: unknown) => Promise<void>
```

</details>
