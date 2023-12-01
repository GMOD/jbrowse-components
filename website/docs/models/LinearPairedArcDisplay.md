---
id: linearpairedarcdisplay
title: LinearPairedArcDisplay
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/arc/src/LinearPairedArcDisplay/model.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/arc/src/LinearPairedArcDisplay/model.ts)

this is a non-block-based track type, and can connect arcs across multiple
displayedRegions

extends

- [BaseDisplay](../basedisplay)
- [TrackHeightMixin](../trackheightmixin)
- [FeatureDensityMixin](../featuredensitymixin)

### LinearPairedArcDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearPairedArcDisplay">
// code
type: types.literal('LinearPairedArcDisplay')
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

### LinearPairedArcDisplay - Getters

#### getter: displayModeSetting

```js
// type
any
```

### LinearPairedArcDisplay - Actions

#### action: selectFeature

```js
// type signature
selectFeature: (feature: Feature) => void
```

#### action: setLoading

```js
// type signature
setLoading: (flag: boolean) => void
```

#### action: setFeatures

```js
// type signature
setFeatures: (f: Feature[]) => void
```

#### action: setDisplayMode

```js
// type signature
setDisplayMode: (flag: string) => void
```

#### action: renderSvg

```js
// type signature
renderSvg: (opts: { rasterizeLayers?: boolean; }) => Promise<React.ReactNode>
```
