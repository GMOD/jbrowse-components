---
id: jbrowsereactapprootmodel
title: JBrowseReactAppRootModel
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

composed of

- [BaseRootModel](../baserootmodel)
- [InternetAccountsMixin](../internetaccountsmixin)
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

### Available via [RootAppMenuMixin](../rootappmenumixin)

**Actions:** setMenus, appendMenu, insertMenu, appendToMenu, insertInMenu,
appendToSubMenu, insertInSubMenu

### JBrowseReactAppRootModel - Volatiles

#### volatile: version

```js
// type signature
string
// code
version
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
})
```

### JBrowseReactAppRootModel - Methods

#### method: menus

```js
// type signature
menus: () => Menu[]
```

### JBrowseReactAppRootModel - Actions

#### action: setPluginsUpdated

```js
// type signature
setPluginsUpdated: () => void
```

#### action: setDefaultSession

BaseRootModel's setDefaultSession reuses defaultSession's literal name;
react-app instead timestamps it so multiple "new sessions" don't collide.

```js
// type signature
setDefaultSession: () => void
```
