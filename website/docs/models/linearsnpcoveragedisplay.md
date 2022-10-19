---
id: linearsnpcoveragedisplay
title: LinearSNPCoverageDisplay
toplevel: true
---

extends `LinearWiggleDisplay`

#### property: type

```js
type: types.literal('LinearSNPCoverageDisplay')
```

#### property: drawInterbaseCounts

```js
drawInterbaseCounts: types.maybe(types.boolean)
```

#### property: drawIndicators

```js
drawIndicators: types.maybe(types.boolean)
```

#### property: drawArcs

```js
drawArcs: types.maybe(types.boolean)
```

#### property: filterBy

```js
filterBy: types.optional(
  types.model({
    flagInclude: types.optional(types.number, 0),
    flagExclude: types.optional(types.number, 1540),
    readName: types.maybe(types.string),
    tagFilter: types.maybe(
      types.model({ tag: types.string, value: types.string }),
    ),
  }),
  {},
)
```

#### property: colorBy

```js
colorBy: types.maybe(
  types.model({
    type: types.string,
    tag: types.maybe(types.string),
  }),
)
```

#### action: setConfig

```js
// Type signature
setConfig: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => void
```

#### action: setFilterBy

```js
// Type signature
setFilterBy: (filter: { flagInclude: number; flagExclude: number; readName?: string; tagFilter?: { tag: string; value: string; }; }) => void
```

#### action: setColorBy

```js
// Type signature
setColorBy: (colorBy?: { type: string; tag?: string; }) => void
```

#### action: updateModificationColorMap

```js
// Type signature
updateModificationColorMap: (uniqueModifications: string[]) => void
```

#### getter: rendererConfig

```js
// Type
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>
```

#### getter: rendererTypeName

```js
// Type
any
```

#### getter: rendererType

the pluggable element type object for this display's
renderer

```js
// Type
RendererType
```

#### getter: drawArcsSetting

```js
// Type
any
```

#### getter: drawInterbaseCountsSetting

```js
// Type
any
```

#### getter: drawIndicatorsSetting

```js
// Type
any
```

#### getter: modificationsReady

```js
// Type
boolean
```

#### method: renderProps

```js
// Type signature
renderProps: () => any
```

#### action: toggleDrawIndicators

```js
// Type signature
toggleDrawIndicators: () => void
```

#### action: toggleDrawInterbaseCounts

```js
// Type signature
toggleDrawInterbaseCounts: () => void
```

#### action: toggleDrawArcs

```js
// Type signature
toggleDrawArcs: () => void
```

#### getter: estimatedStatsReady

```js
// Type
boolean
```

#### getter: regionTooLarge

region is too large if:

- stats are ready
- region is greater than 20kb (don't warn when zoomed in less than that)
- and bytes is greater than max allowed bytes or density greater than max density

```js
// Type
boolean
```

#### getter: parentTrack

```js
// Type
any
```

#### action: setError

```js
// Type signature
setError: (error?: unknown) => void
```

#### getter: TooltipComponent

```js
// Type
any
```

#### getter: adapterConfig

```js
// Type
{
  type: string
  subadapter: any
}
```

#### getter: needsScalebar

```js
// Type
boolean
```

#### method: contextMenuItems

```js
// Type signature
contextMenuItems: () => any[]
```

#### method: trackMenuItems

```js
// Type signature
trackMenuItems: () => any[]
```
