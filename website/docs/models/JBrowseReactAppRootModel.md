---
id: jbrowsereactapprootmodel
title: JBrowseReactAppRootModel
sidebar_label: Root -> JBrowseReactAppRootModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-app/src/rootModel/rootModel.ts).

## Overview

note: many properties of the root model are available through the session, and
we generally prefer using the session model (via e.g. getSession) over the root
model (via e.g. getRoot) in plugin code

## Members

| Member                                         | Kind      | Description |
| ---------------------------------------------- | --------- | ----------- |
| [version](#volatile-version)                   | Volatiles |             |
| [pluginsUpdated](#volatile-pluginsupdated)     | Volatiles |             |
| [rpcManager](#volatile-rpcmanager)             | Volatiles |             |
| [menus](#method-menus)                         | Methods   |             |
| [setPluginsUpdated](#action-setpluginsupdated) | Actions   |             |

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
<summary>JBrowseReactAppRootModel - Volatiles</summary>

#### volatile: version

```ts
// type signature
type version = string
// code
version
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

  defaultDriverName: makeWorkerInstance
    ? 'WebWorkerRpcDriver'
    : 'MainThreadRpcDriver',
})
```

</details>

<details>
<summary>JBrowseReactAppRootModel - Methods</summary>

#### method: menus

```ts
type menus = () => Menu[]
```

</details>

<details>
<summary>JBrowseReactAppRootModel - Actions</summary>

#### action: setPluginsUpdated

```ts
type setPluginsUpdated = () => void
```

</details>
