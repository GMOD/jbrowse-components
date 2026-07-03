---
id: lineararcdisplay
title: LinearArcDisplay
sidebar_label: Display -> LinearArcDisplay
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

## Example usage

Selected on a `FeatureTrack`; each feature is drawn as one arc from its start to
its end. `displayMode` is `arcs` (bezier) or `semicircles`. The `thickness` and
`label` slots default to expressions over the feature `score`, so override them
(plus `color` / `arcHeight`) for data without a score:

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
      color: "jexl:get(feature,'strand')==-1?'red':'blue'",
      arcHeight: 80,
      label: "jexl:get(feature,'name')",
    },
  ],
}
```

## Overview

a non-block-based display drawing one arc per feature, connecting that feature's
own start and end, rendered as plain SVG on the main thread. For arcs that
connect two _separate_ loci (a breakend and its mate) use
[LinearPairedArcDisplay](../linearpairedarcdisplay) instead.

### LinearArcDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/lineararcdisplay).

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
<summary>LinearArcDisplay - Properties</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                     | Signature                         |
| ------------------------------------------ | --------------------------------- |
| [`type`](#property-type)                   | `ISimpleType<"LinearArcDisplay">` |
| [`configuration`](#property-configuration) | `ITypeUnion<any, any, any>`       |

</details>

<details>
<summary>LinearArcDisplay - Properties (all signatures)</summary>

#### property: type

```ts
// type signature
type type = ISimpleType<'LinearArcDisplay'>
// code
type: types.literal('LinearArcDisplay')
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
<summary>LinearArcDisplay - Volatiles</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                     | Signature                |
| ---------------------------------------------------------- | ------------------------ |
| [`features`](#volatile-features)                           | `Feature[] \| undefined` |
| [`loadedRegionSignature`](#volatile-loadedregionsignature) | `string \| undefined`    |
| [`loading`](#volatile-loading)                             | `false`                  |

</details>

<details>
<summary>LinearArcDisplay - Volatiles (all signatures)</summary>

#### volatile: features

```ts
// type signature
type features = Feature[] | undefined
// code
features: undefined as Feature[] | undefined
```

#### volatile: loadedRegionSignature

```ts
// type signature
type loadedRegionSignature = string | undefined
// code
loadedRegionSignature: undefined as string | undefined
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
<summary>LinearArcDisplay - Getters</summary>

#### getter: conf

the config typed off the concrete schema; `ConfigurationReference` erases
`self.configuration` to `any`, so reads route through this to stay typed (same
move as `BaseAdapter<CONF>`)

```ts
type conf = ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>
```

#### getter: svgReady

the SVG-export terminal-state gate (the `SvgExportable` contract every LGV track
display shares). Non-stale: `features` must have been fetched for the _current_
static-block region set (`loadedRegionSignature` matches), so an export fired
mid-refetch after a pan/zoom waits for fresh arcs instead of capturing stale
ones — arc's analogue of the GPU mixins' `viewportWithinLoadedData`. The
first-paint testid + loading anti-flash use `features !== undefined`
(painted-once) directly, not this, so they don't flip on refetch (see
BaseDisplayComponent).

```ts
type svgReady = boolean
```

#### getter: arcStyles

per-feature arc styling, evaluated once when features/config change. Kept out of
the render loop so panning (which only changes pixel positions) doesn't re-run
these jexl expressions per feature per frame.

```ts
type arcStyles =
  | {
      feature: Feature
      color: string
      thickness: any
      label: string
      caption: string
      arcHeight: number
    }[]
  | undefined
```

#### getter: selectedFeatureId

returns the id of the globally-selected feature, used to highlight it

```ts
type selectedFeatureId = string | undefined
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                               | Signature |
| ------------------------------------ | --------- |
| [`displayMode`](#getter-displaymode) | `any`     |

</details>

<details>
<summary>LinearArcDisplay - Getters (all signatures)</summary>

#### getter: displayMode

```ts
type displayMode = any
```

</details>

<details open>
<summary>LinearArcDisplay - Methods</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                     | Signature                                                                                                                                    |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [`trackMenuItems`](#method-trackmenuitems) | `() => (MenuDivider \| MenuSubHeader \| NormalMenuItem \| CheckboxMenuItem \| RadioMenuItem \| SubMenuItem \| CustomMenuItem \| { ...; })[]` |

</details>

<details>
<summary>LinearArcDisplay - Methods (all signatures)</summary>

#### method: trackMenuItems

```ts
type trackMenuItems = () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | CustomMenuItem | { ...; })[]
```

</details>

<details open>
<summary>LinearArcDisplay - Actions</summary>

#### action: reload

retry after an error: clearing `error` re-fires the (error-gated) fetch autorun.
The shared `DisplayErrorBar` retry calls this; the base `reload` is a no-op,
which would leave the display stuck on error.

```ts
type reload = () => void
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                     | Signature                                                             |
| ------------------------------------------ | --------------------------------------------------------------------- |
| [`selectFeature`](#action-selectfeature)   | `(feature: Feature) => void`                                          |
| [`setLoading`](#action-setloading)         | `(flag: boolean) => void`                                             |
| [`setFeatures`](#action-setfeatures)       | `(f: Feature[], signature: string) => void`                           |
| [`setDisplayMode`](#action-setdisplaymode) | `(flag: string) => void`                                              |
| [`renderSvg`](#action-rendersvg)           | `(opts?: ExportSvgDisplayOptions \| undefined) => Promise<ReactNode>` |

</details>

<details>
<summary>LinearArcDisplay - Actions (all signatures)</summary>

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
type setFeatures = (f: Feature[], signature: string) => void
```

#### action: setDisplayMode

```ts
type setDisplayMode = (flag: string) => void
```

#### action: renderSvg

```ts
type renderSvg = (
  opts?: ExportSvgDisplayOptions | undefined,
) => Promise<ReactNode>
```

</details>
