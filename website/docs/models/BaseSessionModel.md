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

#### property: margin

```js
// type signature
number
// code
margin: 0
```

#### property: name

```js
// type signature
ISimpleType<string>
// code
name: types.string
```

### BaseSessionModel - Getters

#### getter: root

```js
// type
TypeOrStateTreeNodeToStateTreeNode<ROOT_MODEL_TYPE>
```

#### getter: adminMode

```js
// type
boolean
```

#### getter: configuration

```js
// type
Instance<JB_CONFIG_SCHEMA>
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

#### getter: textSearchManager

```js
// type
TextSearchManager
```

#### getter: assemblies

```js
// type
({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<ConfigurationSchemaType<{ aliases: { defaultValue: any[]; description: string; type: string; }; cytobands: ConfigurationSchemaType<...>; displayName: { ...; }; refNameAliases: ConfigurationSchemaType<.....
```

### BaseSessionModel - Actions

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

#### action: setSelection

set the global selection, i.e. the globally-selected object. can be a feature, a
view, just about anything

```js
// type signature
setSelection: (thing: unknown) => void
```
