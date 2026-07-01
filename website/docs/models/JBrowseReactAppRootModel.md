---
id: jbrowsereactapprootmodel
title: JBrowseReactAppRootModel
sidebar_label: Root -> JBrowseReactAppRootModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-app/src/rootModel/rootModel.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/JBrowseReactAppRootModel.md)

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
<summary>JBrowseReactAppRootModel - Volatiles</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                       | Signature    |
| -------------------------------------------- | ------------ |
| [`version`](#volatile-version)               | `string`     |
| [`pluginsUpdated`](#volatile-pluginsupdated) | `false`      |
| [`rpcManager`](#volatile-rpcmanager)         | `RpcManager` |

</details>

<details>
<summary>JBrowseReactAppRootModel - Volatiles (all signatures)</summary>

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

<details open>
<summary>JBrowseReactAppRootModel - Methods</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                   | Signature      |
| ------------------------ | -------------- |
| [`menus`](#method-menus) | `() => Menu[]` |

</details>

<details>
<summary>JBrowseReactAppRootModel - Methods (all signatures)</summary>

#### method: menus

```ts
type menus = () => Menu[]
```

</details>

<details open>
<summary>JBrowseReactAppRootModel - Actions</summary>

#### action: setDefaultSession

BaseRootModel's setDefaultSession reuses defaultSession's literal name;
react-app instead timestamps it so multiple "new sessions" don't collide.

```ts
type setDefaultSession = () => void
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                           | Signature    |
| ------------------------------------------------ | ------------ |
| [`setPluginsUpdated`](#action-setpluginsupdated) | `() => void` |

</details>

<details>
<summary>JBrowseReactAppRootModel - Actions (all signatures)</summary>

#### action: setPluginsUpdated

```ts
type setPluginsUpdated = () => void
```

</details>
