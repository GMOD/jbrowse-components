---
id: lineararcdisplay
title: LinearArcDisplay
sidebar_label: Display -> LinearArcDisplay
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`arc` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/arc/src/LinearArcDisplay/model.ts).

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

## Members

| Member                                                   | Kind       | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [type](#property-type)                                   | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [configuration](#property-configuration)                 | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [features](#volatile-features)                           | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [loadedRegionSignature](#volatile-loadedregionsignature) | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [loading](#volatile-loading)                             | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [conf](#getter-conf)                                     | Getters    | the config typed off the concrete schema; `ConfigurationReference` erases `self.configuration` to `any`, so reads route through this to stay typed (same move as `BaseAdapter<CONF>`)                                                                                                                                                                                                                                                                                                                                                                                  |
| [svgReady](#getter-svgready)                             | Getters    | the SVG-export terminal-state gate (the `SvgExportable` contract every LGV track display shares). Non-stale: `features` must have been fetched for the _current_ static-block region set (`loadedRegionSignature` matches), so an export fired mid-refetch after a pan/zoom waits for fresh arcs instead of capturing stale ones — arc's analogue of the GPU mixins' `viewportWithinLoadedData`. The first-paint testid + loading anti-flash use `features !== undefined` (painted-once) directly, not this, so they don't flip on refetch (see BaseDisplayComponent). |
| [displayMode](#getter-displaymode)                       | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [arcStyles](#getter-arcstyles)                           | Getters    | per-feature arc styling, evaluated once when features/config change. Kept out of the render loop so panning (which only changes pixel positions) doesn't re-run these jexl expressions per feature per frame.                                                                                                                                                                                                                                                                                                                                                          |
| [selectedFeatureId](#getter-selectedfeatureid)           | Getters    | returns the id of the globally-selected feature, used to highlight it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [trackMenuItems](#method-trackmenuitems)                 | Methods    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [selectFeature](#action-selectfeature)                   | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [setLoading](#action-setloading)                         | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [setFeatures](#action-setfeatures)                       | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [setDisplayMode](#action-setdisplaymode)                 | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [reload](#action-reload)                                 | Actions    | retry after an error: clearing `error` re-fires the (error-gated) fetch autorun. The shared `DisplayErrorBar` retry calls this; the base `reload` is a no-op, which would leave the display stuck on error.                                                                                                                                                                                                                                                                                                                                                            |
| [renderSvg](#action-rendersvg)                           | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

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

**Methods:** [renderingProps](../basedisplay#method-renderingprops),
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

<details>
<summary>LinearArcDisplay - Properties</summary>

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

<details>
<summary>LinearArcDisplay - Volatiles</summary>

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

<details>
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

</details>

<details>
<summary>LinearArcDisplay - Getters (other undocumented members)</summary>

#### getter: displayMode

```ts
type displayMode = any
```

</details>

<details>
<summary>LinearArcDisplay - Methods</summary>

#### method: trackMenuItems

```ts
type trackMenuItems = () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | CustomMenuItem | { ...; })[]
```

</details>

<details>
<summary>LinearArcDisplay - Actions</summary>

#### action: reload

retry after an error: clearing `error` re-fires the (error-gated) fetch autorun.
The shared `DisplayErrorBar` retry calls this; the base `reload` is a no-op,
which would leave the display stuck on error.

```ts
type reload = () => void
```

</details>

<details>
<summary>LinearArcDisplay - Actions (other undocumented members)</summary>

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
