---
id: linearreadclouddisplay
title: LinearReadCloudDisplay
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearReadCloudDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearReadCloudDisplay.md)

## Docs

it is not a block based track, hence not BaseLinearDisplay extends

- [BaseDisplay](../basedisplay)
- [TrackHeightMixin](../trackheightmixin)
- [FeatureDensityMixin](../featuredensitymixin)

### LinearReadCloudDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearReadCloudDisplay">
// code
type: types.literal('LinearReadCloudDisplay')
```

#### property: configuration

```js
// type signature
AnyConfigurationSchemaType
// code
configuration: ConfigurationReference(configSchema)
```

#### property: drawCloud

```js
// type signature
false
// code
drawCloud: false
```

#### property: noSpacing

Whether to remove spacing between stacked features

```js
// type signature
IMaybe<ISimpleType<boolean>>
// code
noSpacing: types.maybe(types.boolean)
```

#### property: trackMaxHeight

Maximum height for the layout (prevents infinite stacking)

```js
// type signature
IMaybe<ISimpleType<number>>
// code
trackMaxHeight: types.maybe(types.number)
```

### LinearReadCloudDisplay - Getters

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

#### getter: featureHeightSetting

```js
// type
any
```

### LinearReadCloudDisplay - Methods

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; } | { ...; } | { ...; })[]
```

#### method: renderSvg

```js
// type signature
renderSvg: (opts: { rasterizeLayers?: boolean; }) => Promise<React.ReactNode>
```

### LinearReadCloudDisplay - Actions

#### action: reload

```js
// type signature
reload: () => void
```

#### action: setNoSpacing

Set whether to remove spacing between features

```js
// type signature
setNoSpacing: (flag?: boolean) => void
```

#### action: setMaxHeight

Set the maximum height for the layout

```js
// type signature
setMaxHeight: (n?: number) => void
```

#### action: setLayoutHeight

Set the current layout height

```js
// type signature
setLayoutHeight: (n: number) => void
```

#### action: selectFeature

```js
// type signature
selectFeature: (chain: ReducedFeature[]) => void
```

#### action: setDrawCloud

```js
// type signature
setDrawCloud: (b: boolean) => void
```
