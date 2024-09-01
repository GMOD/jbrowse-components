---
id: linearbasicdisplay
title: LinearBasicDisplay
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/linear-genome-view/src/LinearBasicDisplay/model.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/LinearBasicDisplay/model.ts)

used by `FeatureTrack`, has simple settings like "show/hide feature labels",
etc.

extends

- [BaseLinearDisplay](../baselineardisplay)

### LinearBasicDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearBasicDisplay">
// code
type: types.literal('LinearBasicDisplay')
```

#### property: trackShowLabels

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
trackShowLabels: types.maybe(types.boolean)
```

#### property: trackShowDescriptions

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
trackShowDescriptions: types.maybe(types.boolean)
```

#### property: trackDisplayMode

```js
// type signature
IMaybe<ISimpleType<string>>
// code
trackDisplayMode: types.maybe(types.string)
```

#### property: trackMaxHeight

```js
// type signature
IMaybe<ISimpleType<number>>
// code
trackMaxHeight: types.maybe(types.number)
```

#### property: configuration

```js
// type signature
AnyConfigurationSchemaType
// code
configuration: ConfigurationReference(configSchema)
```

#### property: jexlFilters

```js
// type signature
IMaybe<IArrayType<ISimpleType<string>>>
// code
jexlFilters: types.maybe(types.array(types.string))
```

### LinearBasicDisplay - Getters

#### getter: activeFilters

```js
// type
any
```

#### getter: rendererTypeName

```js
// type
any
```

#### getter: showLabels

```js
// type
any
```

#### getter: showDescriptions

```js
// type
any
```

#### getter: maxHeight

```js
// type
any
```

#### getter: displayMode

```js
// type
any
```

#### getter: rendererConfig

```js
// type
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>
```

### LinearBasicDisplay - Methods

#### method: renderProps

```js
// type signature
renderProps: () => { config: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>; filters: SerializableFilterChain; }
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => MenuItem[]
```

### LinearBasicDisplay - Actions

#### action: setJexlFilters

```js
// type signature
setJexlFilters: (f?: string[]) => void
```

#### action: toggleShowLabels

```js
// type signature
toggleShowLabels: () => void
```

#### action: toggleShowDescriptions

```js
// type signature
toggleShowDescriptions: () => void
```

#### action: setDisplayMode

```js
// type signature
setDisplayMode: (val: string) => void
```

#### action: setMaxHeight

```js
// type signature
setMaxHeight: (val?: number) => void
```
