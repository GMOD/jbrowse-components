---
id: lineararcdisplay
title: LinearArcDisplay
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/arc/src/LinearArcDisplay/model.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/arc/src/LinearArcDisplay/model.ts)

extends

- [BaseLinearDisplay](../baselineardisplay)

### LinearArcDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearArcDisplay">
// code
type: types.literal('LinearArcDisplay')
```

#### property: configuration

```js
// type signature
AnyConfigurationSchemaType
// code
configuration: ConfigurationReference(configSchema)
```

#### property: displayMode

```js
// type signature
IMaybe<ISimpleType<string>>
// code
displayMode: types.maybe(types.string)
```

### LinearArcDisplay - Getters

#### getter: blockType

```js
// type
string
```

#### getter: renderDelay

```js
// type
number
```

#### getter: rendererTypeName

```js
// type
any
```

#### getter: displayModeSetting

```js
// type
any
```

#### getter: rendererConfig

```js
// type
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>
```

### LinearArcDisplay - Methods

#### method: renderProps

```js
// type signature
renderProps: () => any
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; })[]
```

### LinearArcDisplay - Actions

#### action: setDisplayMode

```js
// type signature
setDisplayMode: (flag: string) => void
```
