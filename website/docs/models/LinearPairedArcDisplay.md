---
id: linearpairedarcdisplay
title: LinearPairedArcDisplay
sidebar_label: Display -> LinearPairedArcDisplay
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

**Properties:** [id](../basedisplay#property-id),
[type](../basedisplay#property-type),
[rpcDriverName](../basedisplay#property-rpcdrivername)

**Volatiles:** [error](../basedisplay#volatile-error),
[statusMessage](../basedisplay#volatile-statusmessage)

**Getters:** [parentTrack](../basedisplay#getter-parenttrack),
[parentDisplay](../basedisplay#getter-parentdisplay),
[RenderingComponent](../basedisplay#getter-renderingcomponent),
[DisplayBlurb](../basedisplay#getter-displayblurb),
[adapterConfig](../basedisplay#getter-adapterconfig),
[isMinimized](../basedisplay#getter-isminimized),
[effectiveRpcDriverName](../basedisplay#getter-effectiverpcdrivername),
[effectiveTrackConfig](../basedisplay#getter-effectivetrackconfig),
[DisplayMessageComponent](../basedisplay#getter-displaymessagecomponent),
[viewMenuActions](../basedisplay#getter-viewmenuactions)

**Methods:** [renderProps](../basedisplay#method-renderprops),
[renderingProps](../basedisplay#method-renderingprops),
[trackMenuItems](../basedisplay#method-trackmenuitems),
[regionCannotBeRendered](../basedisplay#method-regioncannotberendered)

**Actions:** [setStatusMessage](../basedisplay#action-setstatusmessage),
[setError](../basedisplay#action-seterror),
[setRpcDriverName](../basedisplay#action-setrpcdrivername),
[reload](../basedisplay#action-reload)

### Available via [TrackHeightMixin](../trackheightmixin)

**Properties:** [heightOverride](../trackheightmixin#property-heightoverride)

**Volatiles:** [scrollTop](../trackheightmixin#volatile-scrolltop)

**Getters:** [height](../trackheightmixin#getter-height)

**Actions:** [setScrollTop](../trackheightmixin#action-setscrolltop),
[setHeight](../trackheightmixin#action-setheight),
[resizeHeight](../trackheightmixin#action-resizeheight)

### Available via [FeatureDensityMixin](../featuredensitymixin)

**Properties:**
[userBpPerPxLimit](../featuredensitymixin#property-userbpperpxlimit)

**Volatiles:**
[featureDensityStatsP](../featuredensitymixin#volatile-featuredensitystatsp),
[currStatsBpPerPx](../featuredensitymixin#volatile-currstatsbpperpx)

**Getters:**
[currentBytesRequested](../featuredensitymixin#getter-currentbytesrequested),
[currentFeatureScreenDensity](../featuredensitymixin#getter-currentfeaturescreendensity),
[maxFeatureScreenDensity](../featuredensitymixin#getter-maxfeaturescreendensity),
[featureDensityStatsReady](../featuredensitymixin#getter-featuredensitystatsready),
[maxAllowableBytes](../featuredensitymixin#getter-maxallowablebytes),
[bytesTooLarge](../featuredensitymixin#getter-bytestoolarge),
[densityTooLarge](../featuredensitymixin#getter-densitytoolarge),
[regionTooLarge](../featuredensitymixin#getter-regiontoolarge),
[regionTooLargeReason](../featuredensitymixin#getter-regiontoolargereason),
[featureDensityStatsReadyAndRegionNotTooLarge](../featuredensitymixin#getter-featuredensitystatsreadyandregionnottoolarge)

**Methods:**
[regionCannotBeRendered](../featuredensitymixin#method-regioncannotberendered)

**Actions:**
[setCurrStatsBpPerPx](../featuredensitymixin#action-setcurrstatsbpperpx),
[setFeatureDensityStatsLimit](../featuredensitymixin#action-setfeaturedensitystatslimit),
[getFeatureDensityStats](../featuredensitymixin#action-getfeaturedensitystats),
[setFeatureDensityStatsP](../featuredensitymixin#action-setfeaturedensitystatsp),
[clearFeatureDensityStats](../featuredensitymixin#action-clearfeaturedensitystats)

### Available via [RegionTooLargeMixin](../regiontoolargemixin)

**Properties:**
[userByteSizeLimit](../regiontoolargemixin#property-userbytesizelimit)

**Volatiles:**
[regionTooLargeState](../regiontoolargemixin#volatile-regiontoolargestate),
[regionTooLargeReasonState](../regiontoolargemixin#volatile-regiontoolargereasonstate),
[featureDensityStats](../regiontoolargemixin#volatile-featuredensitystats)

**Getters:** [regionTooLarge](../regiontoolargemixin#getter-regiontoolarge),
[regionTooLargeReason](../regiontoolargemixin#getter-regiontoolargereason)

**Methods:**
[regionCannotBeRenderedText](../regiontoolargemixin#method-regioncannotberenderedtext)

**Actions:**
[setRegionTooLarge](../regiontoolargemixin#action-setregiontoolarge),
[setFeatureDensityStats](../regiontoolargemixin#action-setfeaturedensitystats),
[setFeatureDensityStatsLimit](../regiontoolargemixin#action-setfeaturedensitystatslimit),
[reload](../regiontoolargemixin#action-reload),
[forceLoad](../regiontoolargemixin#action-forceload)

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">LinearPairedArcDisplay - Properties</summary>

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

</details>

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">LinearPairedArcDisplay - Volatiles</summary>

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

</details>

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">LinearPairedArcDisplay - Getters</summary>

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

</details>

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">LinearPairedArcDisplay - Actions</summary>

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

</details>
