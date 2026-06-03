---
id: lineararcdisplay
title: LinearArcDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/arc/src/LinearArcDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearArcDisplay.md)

## Docs

a non-block-based display drawing an arc connecting the start and end of each
feature, rendered as plain SVG on the main thread

extends

- [BaseDisplay](../basedisplay)
- [TrackHeightMixin](../trackheightmixin)
- [FeatureDensityMixin](../featuredensitymixin)

## Example usage

Selected on a `FeatureTrack`; each feature is drawn as an arc from its start to
its end. `displayMode` is `arcs` or `semicircles`:

```js
{
  type: 'FeatureTrack',
  trackId: 'interactions',
  name: 'Interactions',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'Gff3TabixAdapter',
    uri: 'https://example.com/interactions.gff3.gz',
  },
  displays: [
    {
      type: 'LinearArcDisplay',
      displayId: 'interactions-LinearArcDisplay',
      displayMode: 'semicircles',
    },
  ],
}
```

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseDisplay](../basedisplay)

**Properties:** id, type, rpcDriverName

**Getters:** parentTrack, parentDisplay, RenderingComponent, DisplayBlurb,
adapterConfig, isMinimized, effectiveRpcDriverName, effectiveTrackConfig,
rendererType, DisplayMessageComponent, viewMenuActions

**Methods:** renderProps, renderingProps, trackMenuItems, regionCannotBeRendered

**Actions:** setStatusMessage, setError, setRpcDriverName, reload

### Available via [TrackHeightMixin](../trackheightmixin)

**Properties:** heightOverride

**Volatiles:** scrollTop

**Actions:** setScrollTop, setHeight, resizeHeight

### LinearArcDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearArcDisplay">
// code
type: types.literal('LinearArcDisplay')
```

#### property: configuration

```js
// type signature
ITypeUnion<any, any, any>
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

### LinearArcDisplay - Getters

#### getter: fetchSettled

```js
// type
boolean
```

#### getter: displayModeSetting

```js
// type
any
```

#### getter: arcStyles

per-feature arc styling, evaluated once when features/config change. Kept out of
the render loop so panning (which only changes pixel positions) doesn't re-run
these jexl expressions per feature per frame.

```js
// type
{
  feature: Feature
  color: any
  thickness: any
  label: any
  caption: any
  arcHeight: number
}
;[] | undefined
```

#### getter: selectedFeatureId

returns the id of the globally-selected feature, used to highlight it

```js
// type
string | undefined
```

### LinearArcDisplay - Methods

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; })[]
```

### LinearArcDisplay - Actions

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
renderSvg: (opts: { rasterizeLayers?: boolean | undefined; }) => Promise<ReactNode>
```
