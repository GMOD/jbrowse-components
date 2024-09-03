---
id: internetaccountsmixin
title: InternetAccountsMixin
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[packages/product-core/src/RootModel/InternetAccounts.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/RootModel/InternetAccounts.ts)

### InternetAccountsMixin - Properties

#### property: internetAccounts

```js
// type signature
IArrayType<IAnyType>
// code
internetAccounts: types.array(
        pluginManager.pluggableMstType('internet account', 'stateModel'),
      )
```

### InternetAccountsMixin - Actions

#### action: initializeInternetAccount

```js
// type signature
initializeInternetAccount: (internetAccountConfig: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>, initialSnapshot?: {}) => any
```

#### action: createEphemeralInternetAccount

```js
// type signature
createEphemeralInternetAccount: (internetAccountId: string, initialSnapshot: Record<string, unknown>, url: string) => any
```

#### action: findAppropriateInternetAccount

```js
// type signature
findAppropriateInternetAccount: (location: UriLocation) => any
```
