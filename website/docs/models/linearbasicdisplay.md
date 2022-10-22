---
id: linearbasicdisplay
title: LinearBasicDisplay
toplevel: true
---

used by `FeatureTrack`, has simple settings like "show/hide feature labels", etc.

### Properties

#### properties: type

```js
// type signature
ISimpleType<"LinearBasicDisplay">
// code
type: types.literal('LinearBasicDisplay')
```

#### properties: trackShowLabels

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
trackShowLabels: types.maybe(types.boolean)
```

#### properties: trackShowDescriptions

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
trackShowDescriptions: types.maybe(types.boolean)
```

#### properties: trackDisplayMode

```js
// type signature
IMaybe<ISimpleType<string>>
// code
trackDisplayMode: types.maybe(types.string)
```

#### properties: trackMaxHeight

```js
// type signature
IMaybe<ISimpleType<number>>
// code
trackMaxHeight: types.maybe(types.number)
```

#### properties: configuration

```js
// type signature
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

### Getters

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
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>
```

### Methods

#### method: renderProps

```js
// type signature
renderProps: () => { config: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>; }
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => MenuItem[]
```

### Actions

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
setMaxHeight: (val: number) => void
```
