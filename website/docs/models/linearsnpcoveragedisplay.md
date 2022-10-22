---
id: linearsnpcoveragedisplay
title: LinearSNPCoverageDisplay
toplevel: true
---

extends `LinearWiggleDisplay`

### Properties

#### properties: type

```js
// type signature
ISimpleType<"LinearSNPCoverageDisplay">
// code
type: types.literal('LinearSNPCoverageDisplay')
```

#### properties: drawInterbaseCounts

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
drawInterbaseCounts: types.maybe(types.boolean)
```

#### properties: drawIndicators

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
drawIndicators: types.maybe(types.boolean)
```

#### properties: drawArcs

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
drawArcs: types.maybe(types.boolean)
```

#### properties: filterBy

```js
// type signature
IOptionalIType<IModelType<{ flagInclude: IOptionalIType<ISimpleType<number>, [undefined]>; flagExclude: IOptionalIType<ISimpleType<number>, [undefined]>; readName: IMaybe<...>; tagFilter: IMaybe<...>; }, {}, _NotCustomized, _NotCustomized>, [...]>
// code
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

#### properties: colorBy

```js
// type signature
IMaybe<IModelType<{ type: ISimpleType<string>; tag: IMaybe<ISimpleType<string>>; }, {}, _NotCustomized, _NotCustomized>>
// code
colorBy: types.maybe(
          types.model({
            type: types.string,
            tag: types.maybe(types.string),
          }),
        )
```

### Getters

#### getter: rendererConfig

```js
// type
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>
```

#### getter: drawArcsSetting

```js
// type
any
```

#### getter: drawInterbaseCountsSetting

```js
// type
any
```

#### getter: drawIndicatorsSetting

```js
// type
any
```

#### getter: modificationsReady

```js
// type
boolean
```

#### getter: TooltipComponent

```js
// type
any
```

#### getter: adapterConfig

```js
// type
{
  type: string
  subadapter: any
}
```

#### getter: rendererTypeName

```js
// type
string
```

#### getter: needsScalebar

```js
// type
boolean
```

### Methods

#### method: renderProps

```js
// type signature
renderProps: () => any
```

#### method: contextMenuItems

```js
// type signature
contextMenuItems: () => any[]
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => any[]
```

### Actions

#### action: setConfig

```js
// type signature
setConfig: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => void
```

#### action: setFilterBy

```js
// type signature
setFilterBy: (filter: { flagInclude: number; flagExclude: number; readName?: string; tagFilter?: { tag: string; value: string; }; }) => void
```

#### action: setColorBy

```js
// type signature
setColorBy: (colorBy?: { type: string; tag?: string; }) => void
```

#### action: updateModificationColorMap

```js
// type signature
updateModificationColorMap: (uniqueModifications: string[]) => void
```

#### action: toggleDrawIndicators

```js
// type signature
toggleDrawIndicators: () => void
```

#### action: toggleDrawInterbaseCounts

```js
// type signature
toggleDrawInterbaseCounts: () => void
```

#### action: toggleDrawArcs

```js
// type signature
toggleDrawArcs: () => void
```
