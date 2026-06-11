---
id: linearpairedarcdisplay
title: LinearPairedArcDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/arc/src/LinearPairedArcDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearPairedArcDisplay.md)

## Example usage

Selected on a `VariantTrack` of structural variants — arcs connect each breakend
to its mate, even across displayed regions:

```js
{
  type: 'VariantTrack',
  trackId: 'sv',
  name: 'Structural variants',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://example.com/sv.vcf.gz',
  },
  displays: [
    {
      type: 'LinearPairedArcDisplay',
      displayId: 'sv-LinearPairedArcDisplay',
    },
  ],
}
```

## Overview

this is a non-block-based track type, and can connect arcs across multiple
displayedRegions

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseDisplay](../basedisplay)

**Properties:** id, type, rpcDriverName

**Volatiles:** rendererTypeName, error, statusMessage

**Getters:** parentTrack, parentDisplay, RenderingComponent, DisplayBlurb,
adapterConfig, isMinimized, effectiveRpcDriverName, effectiveTrackConfig,
rendererType, DisplayMessageComponent, viewMenuActions

**Methods:** renderProps, renderingProps, trackMenuItems, regionCannotBeRendered

**Actions:** setStatusMessage, setError, setRpcDriverName, reload

### Available via [TrackHeightMixin](../trackheightmixin)

**Properties:** heightOverride

**Volatiles:** scrollTop

**Getters:** height

**Actions:** setScrollTop, setHeight, resizeHeight

### Available via [FeatureDensityMixin](../featuredensitymixin)

**Properties:** userBpPerPxLimit

**Volatiles:** featureDensityStatsP, currStatsBpPerPx

**Getters:** currentBytesRequested, currentFeatureScreenDensity,
maxFeatureScreenDensity, featureDensityStatsReady, maxAllowableBytes,
bytesTooLarge, densityTooLarge, regionTooLarge, regionTooLargeReason,
featureDensityStatsReadyAndRegionNotTooLarge

**Methods:** regionCannotBeRendered

**Actions:** setCurrStatsBpPerPx, setFeatureDensityStatsLimit,
getFeatureDensityStats, setFeatureDensityStatsP, clearFeatureDensityStats

### Available via [RegionTooLargeMixin](../regiontoolargemixin)

**Properties:** userByteSizeLimit

**Volatiles:** regionTooLargeState, regionTooLargeReasonState,
featureDensityStats

**Getters:** regionTooLarge, regionTooLargeReason

**Methods:** regionCannotBeRenderedText

**Actions:** setRegionTooLarge, setFeatureDensityStats,
setFeatureDensityStatsLimit, reload, forceLoad

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
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

### LinearPairedArcDisplay - Volatiles

#### volatile: features

```js
// type signature
Feature[] | undefined
// code
features: undefined as Feature[] | undefined
```

#### volatile: loading

```js
// type signature
false
// code
loading: false
```

### LinearPairedArcDisplay - Getters

#### getter: conf

the config typed off the concrete schema; `ConfigurationReference` erases
`self.configuration` to `any`, so reads route through this to stay typed (same
move as `BaseAdapter<CONF>`)

```js
// type
ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>
```

#### getter: fetchSettled

```js
// type
boolean
```

#### getter: arcStyles

per-arc styling and endpoint pairs (one per ALT), evaluated once when
features/config change. Keeps the color jexl and makeFeaturePair (which runs
parseSvAlt) out of the per-pan render loop.

```js
// type
{ k1: { refName: string; start: number; end: number; strand: 0 | 1 | -1; mateDirection: number; }; k2: { refName: string; start: number; end: number; mateDirection?: number | undefined; }; feature: Feature; alt: string | undefined; color: string; }[] | undefined
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

#### action: renderSvg

```js
// type signature
renderSvg: (opts: { rasterizeLayers?: boolean | undefined; }) => Promise<ReactNode>
```
