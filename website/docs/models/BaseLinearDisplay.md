---
id: baselineardisplay
title: BaseLinearDisplay
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/linear-genome-view/src/BaseLinearDisplay/models/BaseLinearDisplayModel.tsx](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/BaseLinearDisplay/models/BaseLinearDisplayModel.tsx)

BaseLinearDisplay is used as the basis for many linear genome view tracks. It is
block based, and can use 'static blocks' or 'dynamic blocks'

extends

- [BaseDisplay](../basedisplay)
- [TrackHeightMixin](../trackheightmixin)
- [FeatureDensityMixin](../featuredensitymixin)

### BaseLinearDisplay - Properties

#### property: blockState

updated via autorun

```js
// type signature
IMapType<IModelType<{ isLeftEndOfDisplayedRegion: IType<boolean, boolean, boolean>; isRightEndOfDisplayedRegion: IType<boolean, boolean, boolean>; key: ISimpleType<string>; region: IModelType<...>; reloadFlag: IType<...>; }, { ...; } & { ...; }, _NotCustomized, _NotCustomized>>
// code
blockState: types.map(BlockState)
```

#### property: configuration

```js
// type signature
ConfigurationSchemaType<{ fetchSizeLimit: { defaultValue: number; description: string; type: string; }; height: { defaultValue: number; description: string; type: string; }; maxFeatureScreenDensity: { defaultValue: number; description: string; type: string; }; mouseover: { ...; }; }, ConfigurationSchemaOptions<...>>
// code
configuration: ConfigurationReference(configSchema)
```

### BaseLinearDisplay - Getters

#### getter: blockDefinitions

```js
// type
any
```

#### getter: blockType

```js
// type
'dynamicBlocks' | 'staticBlocks'
```

#### getter: DisplayMessageComponent

if a display-level message should be displayed instead of the blocks, make this
return a react component

```js
// type
any
```

#### getter: TooltipComponent

```js
// type
React.FC<any>
```

#### getter: renderDelay

how many milliseconds to wait for the display to "settle" before re-rendering a
block

```js
// type
number
```

#### getter: selectedFeatureId

returns a string feature ID if the globally-selected object is probably a
feature

```js
// type
string
```

#### getter: featureUnderMouse

```js
// type
any
```

#### getter: features

a CompositeMap of `featureId -> feature obj` that just looks in all the block
data for that feature

```js
// type
CompositeMap<unknown, unknown>
```

#### getter: getFeatureByID

```js
// type
(blockKey: string, id: string) => LayoutRecord
```

#### getter: getFeatureOverlapping

```js
// type
(blockKey: string, x: number, y: number) => string
```

#### getter: searchFeatureByID

```js
// type
(id: string) => LayoutRecord
```

### BaseLinearDisplay - Methods

#### method: contextMenuItems

```js
// type signature
contextMenuItems: () => MenuItem[]
```

#### method: renderProps

```js
// type signature
renderProps: () => any
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => MenuItem[]
```

#### method: renderSvg

```js
// type signature
renderSvg: (opts: ExportSvgDisplayOptions) => Promise<Element>
```

### BaseLinearDisplay - Actions

#### action: addBlock

```js
// type signature
addBlock: (key: string, block: BaseBlock) => void
```

#### action: clearFeatureSelection

```js
// type signature
clearFeatureSelection: () => void
```

#### action: deleteBlock

```js
// type signature
deleteBlock: (key: string) => void
```

#### action: selectFeature

```js
// type signature
selectFeature: (feature: Feature) => void
```

#### action: setContextMenuFeature

```js
// type signature
setContextMenuFeature: (feature?: Feature) => void
```

#### action: setFeatureIdUnderMouse

```js
// type signature
setFeatureIdUnderMouse: (feature?: string) => void
```

#### action: reload

```js
// type signature
reload: () => Promise<void>
```
