---
id: jbrowsewebrootmodel
title: JBrowseWebRootModel
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[products/jbrowse-web/src/rootModel/rootModel.ts](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-web/src/rootModel/rootModel.ts)

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

### JBrowseWebRootModel - Getters

#### getter: savedSessions

```js
// type
any[]
```

#### getter: autosaveId

```js
// type
string
```

#### getter: previousAutosaveId

```js
// type
string
```

#### getter: savedSessionNames

```js
// type
any[]
```

#### getter: currentSessionId

```js
// type
string
```

### JBrowseWebRootModel - Methods

#### method: localStorageId

```js
// type signature
localStorageId: (name: string) => string
```

### JBrowseWebRootModel - Actions

#### action: setSession

```js
// type signature
setSession: (sessionSnapshot?: ModelCreationType<ExtractCFromProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; name: ISimpleType<string>; margin: IType<number, number, number>; }>>) => void
```

#### action: setPluginsUpdated

```js
// type signature
setPluginsUpdated: (flag: boolean) => void
```

#### action: setDefaultSession

```js
// type signature
setDefaultSession: () => void
```

#### action: renameCurrentSession

```js
// type signature
renameCurrentSession: (sessionName: string) => void
```

#### action: addSavedSession

```js
// type signature
addSavedSession: (session: { name: string; }) => void
```

#### action: removeSavedSession

```js
// type signature
removeSavedSession: (session: { name: string; }) => void
```

#### action: duplicateCurrentSession

```js
// type signature
duplicateCurrentSession: () => void
```

#### action: activateSession

```js
// type signature
activateSession: (name: string) => void
```

#### action: saveSessionToLocalStorage

```js
// type signature
saveSessionToLocalStorage: () => void
```

#### action: setError

```js
// type signature
setError: (error?: unknown) => void
```
