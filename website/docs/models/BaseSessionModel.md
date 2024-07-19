---
id: basesessionmodel
title: BaseSessionModel
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[packages/product-core/src/Session/BaseSession.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/BaseSession.ts)

base session shared by all JBrowse products. Be careful what you include here,
everything will use it.

### BaseSessionModel - Properties

#### property: id

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: name

```js
// type signature
ISimpleType<string>
// code
name: types.string
```

#### property: margin

```js
// type signature
number
// code
margin: 0
```

### BaseSessionModel - Getters

#### getter: root

```js
// type
TypeOrStateTreeNodeToStateTreeNode<ROOT_MODEL_TYPE>
```

#### getter: jbrowse

```js
// type
any
```

#### getter: rpcManager

```js
// type
RpcManager
```

#### getter: configuration

```js
// type
Instance<JB_CONFIG_SCHEMA>
```

#### getter: adminMode

```js
// type
boolean
```

#### getter: textSearchManager

```js
// type
TextSearchManager
```

#### getter: assemblies

```js
// type
({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & { ...; } & IStateTreeNode<...>); } & IStateTreeNode<...>)[]
```

### BaseSessionModel - Actions

#### action: setSelection

set the global selection, i.e. the globally-selected object. can be a feature, a
view, just about anything

```js
// type signature
setSelection: (thing: unknown) => void
```

#### action: clearSelection

clears the global selection

```js
// type signature
clearSelection: () => void
```

#### action: setHovered

```js
// type signature
setHovered: (thing: unknown) => void
```
