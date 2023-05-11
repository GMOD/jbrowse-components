---
id: basesessionmodel
title: BaseSessionModel
toplevel: true
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

## Source file

[packages/product-core/src/Session/Base.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/Base.ts)

## Docs

base session shared by **all** JBrowse products. Be careful what you include
here, everything will use it.

### BaseSessionModel - Properties

#### property: id

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: types.optional(types.identifier, shortid())
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

#### getter: jbrowse

```js
// type
any
```

#### getter: rpcManager

```js
// type
any
```

#### getter: configuration

```js
// type
Instance<JB_CONFIG_SCHEMA>
```

#### getter: assemblies

```js
// type
({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<ConfigurationSchemaType<{ aliases: { type: string; defaultValue: any[]; description: string; }; sequence: AnyConfigurationSchemaType; refNameColors: { ...; }; refNameAliases: ConfigurationSchemaType<......
```

#### getter: textSearchManager

```js
// type
any
```

#### getter: version

```js
// type
any
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
