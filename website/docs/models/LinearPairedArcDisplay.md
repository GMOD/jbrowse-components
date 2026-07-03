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

Selected on a `VariantTrack` of structural variants: each feature draws an arc
from its position to its mate breakend, even when the mate is on another
chromosome / displayed region. Short ticks mark each breakend's mate direction;
clicking an arc opens the variant details:

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

a non-block-based display that draws one arc per feature from its position to its
mate breakend (parsed from the VCF `ALT`), connecting the two loci of a
structural variant even across displayed regions / chromosomes; rendered as plain
SVG on the main thread. For arcs that span a single feature's own start–end use
[LinearArcDisplay](../lineararcdisplay) instead.

### LinearPairedArcDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/linearpairedarcdisplay).

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseDisplay](../basedisplay)

**Properties:** [id](../basedisplay#property-id),
[type](../basedisplay#property-type),
[rpcDriverName](../basedisplay#property-rpcdrivername)

**Volatiles:** [error](../basedisplay#volatile-error),
[statusMessage](../basedisplay#volatile-statusmessage),
[statusProgress](../basedisplay#volatile-statusprogress)

**Getters:** [parentTrack](../basedisplay#getter-parenttrack),
[parentDisplay](../basedisplay#getter-parentdisplay),
[RenderingComponent](../basedisplay#getter-renderingcomponent),
[DisplayBlurb](../basedisplay#getter-displayblurb),
[adapterConfig](../basedisplay#getter-adapterconfig),
[isMinimized](../basedisplay#getter-isminimized),
[effectiveRpcDriverName](../basedisplay#getter-effectiverpcdrivername),
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

**Volatiles:** [scrollTop](../trackheightmixin#volatile-scrolltop)

**Getters:** [height](../trackheightmixin#getter-height)

**Actions:** [setScrollTop](../trackheightmixin#action-setscrolltop),
[setHeight](../trackheightmixin#action-setheight),
[resizeHeight](../trackheightmixin#action-resizeheight)

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
<summary>LinearPairedArcDisplay - Properties</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                     | Signature                               |
| ------------------------------------------ | --------------------------------------- |
| [`type`](#property-type)                   | `ISimpleType<"LinearPairedArcDisplay">` |
| [`configuration`](#property-configuration) | `ITypeUnion<any, any, any>`             |

</details>

<details>
<summary>LinearPairedArcDisplay - Properties (all signatures)</summary>

#### property: type

```ts
// type signature
type type = ISimpleType<'LinearPairedArcDisplay'>
// code
type: types.literal('LinearPairedArcDisplay')
```

#### property: configuration

```ts
// type signature
type configuration = ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

</details>

<details open>
<summary>LinearPairedArcDisplay - Volatiles</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                           | Signature                |
| -------------------------------- | ------------------------ |
| [`features`](#volatile-features) | `Feature[] \| undefined` |
| [`loading`](#volatile-loading)   | `false`                  |

</details>

<details>
<summary>LinearPairedArcDisplay - Volatiles (all signatures)</summary>

#### volatile: features

```ts
// type signature
type features = Feature[] | undefined
// code
features: undefined as Feature[] | undefined
```

#### volatile: loading

```ts
// type signature
type loading = false
// code
loading: false
```

</details>

<details open>
<summary>LinearPairedArcDisplay - Getters</summary>

#### getter: conf

the config typed off the concrete schema; `ConfigurationReference` erases
`self.configuration` to `any`, so reads route through this to stay typed (same
move as `BaseAdapter<CONF>`)

```ts
type conf = ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>
```

#### getter: svgReady

the SVG-export terminal-state gate (the `SvgExportable` contract every LGV track
display shares). Arc fetches all features into a single array via
`FeatureDensityMixin`, so it has no `loadedRegions` spatial-coverage signal like
the GPU mixins — "settled" is just features-present / error / too-large. Known
gap: this stays true through an in-place refetch, so an export fired immediately
after a pan/zoom can capture stale arcs (same stale-then-reposition behavior arc
shows on-screen); tightening it would need fetch-generation tracking the
single-array model lacks.

```ts
type svgReady = boolean
```

#### getter: arcStyles

per-arc styling and endpoint pairs (one per ALT), evaluated once when
features/config change. Keeps the color jexl and makeFeaturePair (which runs
parseSvAlt) out of the per-pan render loop. Deduped on a canonical endpoint-pair
key: a paired feature is emitted from both endpoints and reciprocal BNDs arrive
as two records, so the same arc otherwise draws twice whenever both endpoints
are in the fetched regions.

```ts
type arcStyles =
  | {
      k1: {
        refName: string
        start: number
        end: number
        strand: 0 | 1 | -1
        mateDirection: number
      }
      k2: {
        refName: string
        start: number
        end: number
        mateDirection?: number | undefined
      }
      feature: Feature
      alt: string | undefined
      color: string
    }[]
  | undefined
```

</details>

<details open>
<summary>LinearPairedArcDisplay - Actions</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                   | Signature                                                             |
| ---------------------------------------- | --------------------------------------------------------------------- |
| [`selectFeature`](#action-selectfeature) | `(feature: Feature) => void`                                          |
| [`setLoading`](#action-setloading)       | `(flag: boolean) => void`                                             |
| [`setFeatures`](#action-setfeatures)     | `(f: Feature[]) => void`                                              |
| [`renderSvg`](#action-rendersvg)         | `(opts?: ExportSvgDisplayOptions \| undefined) => Promise<ReactNode>` |

</details>

<details>
<summary>LinearPairedArcDisplay - Actions (all signatures)</summary>

#### action: selectFeature

```ts
type selectFeature = (feature: Feature) => void
```

#### action: setLoading

```ts
type setLoading = (flag: boolean) => void
```

#### action: setFeatures

```ts
type setFeatures = (f: Feature[]) => void
```

#### action: renderSvg

```ts
type renderSvg = (
  opts?: ExportSvgDisplayOptions | undefined,
) => Promise<ReactNode>
```

</details>
