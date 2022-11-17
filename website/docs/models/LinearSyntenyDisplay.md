---
id: linearsyntenydisplay
title: LinearSyntenyDisplay
toplevel: true
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See [Core concepts and intro to pluggable
elements](/docs/developer_guide/) for more info

## Docs

extends `LinearComparativeDisplay` model

### LinearSyntenyDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearSyntenyDisplay">
// code
type: types.literal('LinearSyntenyDisplay')
```

#### property: configuration

```js
// type signature
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

### LinearSyntenyDisplay - Getters

#### getter: rendererTypeName

```js
// type
any
```

#### getter: adapterConfig

```js
// type
any
```

#### getter: trackIds

unused

```js
// type
string[]
```

### LinearSyntenyDisplay - Methods

#### method: renderProps

```js
// type signature
renderProps: () => { rpcDriverName: string; displayModel: { id: string; type: never; rpcDriverName: string; configuration: any; height: number; } & NonEmptyObject & { rendererTypeName: string; error: unknown; } & ... 5 more ... & IStateTreeNode<...>; config: any; width: number; height: number; }
```
