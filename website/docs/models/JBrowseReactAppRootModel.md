---
id: jbrowsereactapprootmodel
title: JBrowseReactAppRootModel
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[products/jbrowse-react-app/src/rootModel/index.ts](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-app/src/rootModel/index.ts)

composed of

- [BaseRootModel](../baserootmodel)
- [InternetAccountsMixin](../internetaccountsmixin)
- [RootAppMenuMixin](../rootappmenumixin)

note: many properties of the root model are available through the session, and
we generally prefer using the session model (via e.g. getSession) over the root
model (via e.g. getRoot) in plugin code

### JBrowseReactAppRootModel - Actions

#### action: renameCurrentSession

```js
// type signature
renameCurrentSession: (sessionName: string) => void
```

#### action: setDefaultSession

```js
// type signature
setDefaultSession: () => void
```

#### action: setError

```js
// type signature
setError: (error?: unknown) => void
```

#### action: setPluginsUpdated

```js
// type signature
setPluginsUpdated: (flag: boolean) => void
```

#### action: setSession

```js
// type signature
setSession: (sessionSnapshot?: ModelCreationType<ExtractCFromProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; margin: IType<number, number, number>; name: ISimpleType<string>; }>>) => void
```
