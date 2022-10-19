---
id: linearbasicdisplay
title: LinearBasicDisplay
toplevel: true
---

used by `FeatureTrack`, has simple settings like "show/hide feature labels", etc.

#### property: type

```js
type: types.literal('LinearBasicDisplay')
```

#### property: trackShowLabels

```js
trackShowLabels: types.maybe(types.boolean)
```

#### property: trackShowDescriptions

```js
trackShowDescriptions: types.maybe(types.boolean)
```

#### property: trackDisplayMode

```js
trackDisplayMode: types.maybe(types.string)
```

#### property: trackMaxHeight

```js
trackMaxHeight: types.maybe(types.number)
```

#### property: configuration

```js
configuration: ConfigurationReference(configSchema)
```

#### getter: rendererTypeName

```js
// Type
any
```

#### getter: showLabels

```js
// Type
any
```

#### getter: showDescriptions

```js
// Type
any
```

#### getter: maxHeight

```js
// Type
any
```

#### getter: displayMode

```js
// Type
any
```

#### getter: rendererConfig

```js
// Type
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>
```

#### getter: rendererType

the pluggable element type object for this display's
renderer

```js
// Type
RendererType
```

#### action: toggleShowLabels

```js
// Type signature
toggleShowLabels: () => void
```

#### action: toggleShowDescriptions

```js
// Type signature
toggleShowDescriptions: () => void
```

#### action: setDisplayMode

```js
// Type signature
setDisplayMode: (val: string) => void
```

#### action: setMaxHeight

```js
// Type signature
setMaxHeight: (val: number) => void
```

#### method: renderProps

```js
// Type signature
renderProps: () => { config: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>; }
```

#### method: trackMenuItems

```js
// Type signature
trackMenuItems: () => MenuItem[]
```

#### action: navToLocString

navigate to the given locstring

```js
// Type signature
navToLocString: (locString: string, optAssemblyName?: string) => void
```

#### action: showTrack

```js
// Type signature
showTrack: (
  trackId: string,
  initialSnapshot?: {},
  displayInitialSnapshot?: {},
) => any
```
