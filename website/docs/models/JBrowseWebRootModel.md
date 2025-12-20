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

## Docs

composed of

- [BaseRootModel](../baserootmodel)
- [InternetAccountsMixin](../internetaccountsmixin)
- [HistoryManagementMixin](../historymanagementmixin)
- [RootAppMenuMixin](../rootappmenumixin)

note: many properties of the root model are available through the session, and
we generally prefer using the session model (via e.g. getSession) over the root
model (via e.g. getRoot) in plugin code

### JBrowseWebRootModel - Properties

#### property: configPath

```js
// type signature
IMaybe<ISimpleType<string>>
// code
configPath: types.maybe(types.string)
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

#### action: setSession

```js
// type signature
setSession: (sessionSnapshot: ModelCreationType<ExtractCFromProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; name: ISimpleType<string>; margin: IType<number, number, number>; }>>) => void
```

#### action: setPluginsUpdated

```js
// type signature
setPluginsUpdated: (flag: boolean) => void
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

#### action: favoriteSavedSession

```js
// type signature
favoriteSavedSession: (id: string) => Promise<void>
```

#### action: unfavoriteSavedSession

```js
// type signature
unfavoriteSavedSession: (id: string) => Promise<void>
```

#### action: deleteSavedSession

```js
// type signature
deleteSavedSession: (id: string) => Promise<void>
```

#### action: renameCurrentSession

```js
// type signature
renameCurrentSession: (sessionName: string) => void
```

#### action: setError

```js
// type signature
setError: (error?: unknown) => void
```
