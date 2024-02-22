---
id: linearsnpcoveragedisplay
title: LinearSNPCoverageDisplay
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/alignments/src/LinearSNPCoverageDisplay/models/model.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearSNPCoverageDisplay/models/model.ts)

extends

- [LinearWiggleDisplay](../linearwiggledisplay)

### LinearSNPCoverageDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearSNPCoverageDisplay">
// code
type: types.literal('LinearSNPCoverageDisplay')
```

#### property: drawInterbaseCounts

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
drawInterbaseCounts: types.maybe(types.boolean)
```

#### property: drawIndicators

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
drawIndicators: types.maybe(types.boolean)
```

#### property: drawArcs

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
drawArcs: types.maybe(types.boolean)
```

#### property: filterBy

```js
// type signature
IOptionalIType<IModelType<{ flagInclude: IOptionalIType<ISimpleType<number>, [undefined]>; flagExclude: IOptionalIType<ISimpleType<number>, [undefined]>; readName: IMaybe<...>; tagFilter: IMaybe<...>; }, {}, _NotCustomized, _NotCustomized>, [...]>
// code
filterBy: types.optional(FilterModel, {})
```

#### property: colorBy

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

#### property: jexlFilters

```js
// type signature
IOptionalIType<IArrayType<ISimpleType<string>>, [undefined]>
// code
jexlFilters: types.optional(types.array(types.string), [])
```

### LinearSNPCoverageDisplay - Getters

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

#### getter: autorunReady

```js
// type
boolean
```

#### getter: TooltipComponent

```js
// type
(props: { model: { featureUnderMouse: Feature; }; height: number; offsetMouseCoord: Coord; clientMouseCoord: Coord; clientRect?: DOMRect; }) => Element
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

#### getter: filters

```js
// type
SerializableFilterChain
```

### LinearSNPCoverageDisplay - Methods

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
trackMenuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; })[]
```

### LinearSNPCoverageDisplay - Actions

#### action: setConfig

```js
// type signature
setConfig: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => void
```

#### action: setFilterBy

```js
// type signature
setFilterBy: (filter: IFilter) => void
```

#### action: setColorBy

```js
// type signature
setColorBy: (colorBy?: { type: string; tag?: string; }) => void
```

#### action: setJexlFilters

```js
// type signature
setJexlFilters: (filters: string[]) => void
```

#### action: updateModificationColorMap

```js
// type signature
updateModificationColorMap: (uniqueModifications: string[]) => void
```

#### action: setModificationsReady

```js
// type signature
setModificationsReady: (flag: boolean) => void
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
