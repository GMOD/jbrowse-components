---
id: linearsnpcoveragedisplay
title: LinearSNPCoverageDisplay
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearSNPCoverageDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearSNPCoverageDisplay.md)

## Docs

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

#### property: showInterbaseCounts

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
showInterbaseCounts: types.maybe(types.boolean)
```

#### property: showInterbaseIndicators

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
showInterbaseIndicators: types.maybe(types.boolean)
```

#### property: showArcs

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
showArcs: types.maybe(types.boolean)
```

#### property: filterBySetting

```js
// type signature
IType<FilterBy, FilterBy, FilterBy>
// code
filterBySetting: types.frozen<FilterBy | undefined>()
```

#### property: colorBySetting

```js
// type signature
IType<ColorBy, ColorBy, ColorBy>
// code
colorBySetting: types.frozen<ColorBy | undefined>()
```

#### property: jexlFilters

```js
// type signature
IOptionalIType<IArrayType<ISimpleType<string>>, [undefined]>
// code
jexlFilters: types.optional(types.array(types.string), [])
```

### LinearSNPCoverageDisplay - Getters

#### getter: colorBy

```js
// type
any
```

#### getter: filterBy

```js
// type
any
```

#### getter: modificationThreshold

```js
// type
any
```

#### getter: rendererConfig

```js
// type
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>
```

#### getter: showArcsSetting

```js
// type
any
```

#### getter: showInterbaseCountsSetting

```js
// type
any
```

#### getter: showInterbaseIndicatorsSetting

```js
// type
any
```

#### getter: autorunReady

```js
// type
boolean
```

#### getter: renderReady

```js
// type
;() => boolean
```

#### getter: TooltipComponent

```js
// type
LazyExoticComponent<(props: { model: { featureUnderMouse?: Feature; }; height: number; offsetMouseCoord: Coord; clientMouseCoord: Coord; clientRect?: DOMRect; }) => Element>
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

#### getter: graphType

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

#### method: adapterProps

```js
// type signature
adapterProps: () => any
```

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
setConfig: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>) => void
```

#### action: setFilterBy

```js
// type signature
setFilterBy: (filter: FilterBy) => void
```

#### action: setColorScheme

```js
// type signature
setColorScheme: (colorBy?: ColorBy) => void
```

#### action: setJexlFilters

```js
// type signature
setJexlFilters: (filters: string[]) => void
```

#### action: updateVisibleModifications

```js
// type signature
updateVisibleModifications: (uniqueModifications: ModificationType[]) => void
```

#### action: setSimplexModifications

```js
// type signature
setSimplexModifications: (simplex: string[]) => void
```

#### action: setModificationsReady

```js
// type signature
setModificationsReady: (flag: boolean) => void
```

#### action: setShowInterbaseIndicators

```js
// type signature
setShowInterbaseIndicators: (arg: boolean) => void
```

#### action: setShowInterbaseCounts

```js
// type signature
setShowInterbaseCounts: (arg: boolean) => void
```

#### action: setShowArcs

```js
// type signature
setShowArcs: (arg: boolean) => void
```
