---
id: linearhicdisplay
title: LinearHicDisplay
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/hic/src/LinearHicDisplay/model.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/hic/src/LinearHicDisplay/model.ts)

extends `BaseLinearDisplay`

### LinearHicDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearHicDisplay">
// code
type: types.literal('LinearHicDisplay')
```

#### property: configuration

```js
// type signature
AnyConfigurationSchemaType
// code
configuration: ConfigurationReference(configSchema)
```

#### property: resolution

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
resolution: types.optional(types.number, 1)
```

### LinearHicDisplay - Getters

#### getter: blockType

```js
// type
string
```

#### getter: rendererTypeName

```js
// type
string
```

#### getter: trackMenuItems

```js
// type
() => MenuItem[]
```

### LinearHicDisplay - Methods

#### method: renderProps

```js
// type signature
renderProps: () => any
```

### LinearHicDisplay - Actions

#### action: setResolution

```js
// type signature
setResolution: (n: number) => void
```
