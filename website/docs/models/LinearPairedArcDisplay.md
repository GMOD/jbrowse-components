---
id: linearpairedarcdisplay
title: LinearPairedArcDisplay
sidebar_label: Display -> LinearPairedArcDisplay
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`arc` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/arc/src/LinearPairedArcDisplay/model.ts).

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

a non-block-based display that draws one arc per feature from its position to
its mate breakend (parsed from the VCF `ALT`), connecting the two loci of a
structural variant even across displayed regions / chromosomes; rendered as
plain SVG on the main thread. For arcs that span a single feature's own
start–end use [LinearArcDisplay](../lineararcdisplay) instead.

## Members

| Member                                                             | Kind       | Defined by                                    | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------ | ---------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [type](#property-type)                                             | Properties | LinearPairedArcDisplay                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [configuration](#property-configuration)                           | Properties | LinearPairedArcDisplay                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [features](#volatile-features)                                     | Volatiles  | LinearPairedArcDisplay                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [loadedRegionSignature](#volatile-loadedregionsignature)           | Volatiles  | LinearPairedArcDisplay                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [loading](#volatile-loading)                                       | Volatiles  | LinearPairedArcDisplay                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [conf](#getter-conf)                                               | Getters    | LinearPairedArcDisplay                        | the config typed off the concrete schema; `ConfigurationReference` erases `self.configuration` to `any`, so reads route through this to stay typed (same move as `BaseAdapter<CONF>`)                                                                                                                                                                                                                                                                                                                                                                                  |
| [lineWidth](#getter-linewidth)                                     | Getters    | LinearPairedArcDisplay                        | arc stroke width in px, from the promotable `lineWidth` slot (track-menu slider writes it); flat across all arcs                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [svgReady](#getter-svgready)                                       | Getters    | LinearPairedArcDisplay                        | the SVG-export terminal-state gate (the `SvgExportable` contract every LGV track display shares). Non-stale: `features` must have been fetched for the _current_ static-block region set (`loadedRegionSignature` matches), so an export fired mid-refetch after a pan/zoom waits for fresh arcs instead of capturing stale ones — arc's analogue of the GPU mixins' `viewportWithinLoadedData`. The first-paint testid + loading anti-flash use `features !== undefined` (painted-once) directly, not this, so they don't flip on refetch (see BaseDisplayComponent). |
| [arcStyles](#getter-arcstyles)                                     | Getters    | LinearPairedArcDisplay                        | per-arc styling and endpoint pairs (one per ALT), evaluated once when features/config change. Keeps the color jexl and makeFeaturePair (which runs parseSvAlt) out of the per-pan render loop. Deduped on a canonical endpoint-pair key: a paired feature is emitted from both endpoints and reciprocal BNDs arrive as two records, so the same arc otherwise draws twice whenever both endpoints are in the fetched regions.                                                                                                                                          |
| [trackMenuItems](#method-trackmenuitems)                           | Methods    | LinearPairedArcDisplay                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [selectFeature](#action-selectfeature)                             | Actions    | LinearPairedArcDisplay                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [setLoading](#action-setloading)                                   | Actions    | LinearPairedArcDisplay                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [setFeatures](#action-setfeatures)                                 | Actions    | LinearPairedArcDisplay                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [setLineWidth](#action-setlinewidth)                               | Actions    | LinearPairedArcDisplay                        | set arc stroke width; `undefined` resets to the config-slot default                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [reload](#action-reload)                                           | Actions    | LinearPairedArcDisplay                        | retry after an error: clearing `error` re-fires the (error-gated) fetch autorun. The shared `DisplayErrorBar` retry calls this; the base `reload` is a no-op, which would leave the display stuck on error.                                                                                                                                                                                                                                                                                                                                                            |
| [renderSvg](#action-rendersvg)                                     | Actions    | LinearPairedArcDisplay                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [id](#property-id)                                                 | Properties | [BaseDisplay](../basedisplay)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [rpcDriverName](#property-rpcdrivername)                           | Properties | [BaseDisplay](../basedisplay)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [error](#volatile-error)                                           | Volatiles  | [BaseDisplay](../basedisplay)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [statusMessage](#volatile-statusmessage)                           | Volatiles  | [BaseDisplay](../basedisplay)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [statusProgress](#volatile-statusprogress)                         | Volatiles  | [BaseDisplay](../basedisplay)                 | determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate. Set alongside `statusMessage` by `setStatusMessage`; a display that never shows a bar simply leaves it undefined.                                                                                                                                                                                                                                                                                                                                  |
| [parentTrack](#getter-parenttrack)                                 | Getters    | [BaseDisplay](../basedisplay)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [parentDisplay](#getter-parentdisplay)                             | Getters    | [BaseDisplay](../basedisplay)                 | Returns the parent display if this display is nested within another display (e.g., PileupDisplay inside LinearAlignmentsDisplay)                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [RenderingComponent](#getter-renderingcomponent)                   | Getters    | [BaseDisplay](../basedisplay)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [DisplayBlurb](#getter-displayblurb)                               | Getters    | [BaseDisplay](../basedisplay)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [adapterConfig](#getter-adapterconfig)                             | Getters    | [BaseDisplay](../basedisplay)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [isMinimized](#getter-isminimized)                                 | Getters    | [BaseDisplay](../basedisplay)                 | Returns true if the parent track is minimized. Used to skip expensive operations like autoruns when track is not visible.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [effectiveRpcDriverName](#getter-effectiverpcdrivername)           | Getters    | [BaseDisplay](../basedisplay)                 | Returns the effective RPC driver name with hierarchical fallback: 1. This display's explicit rpcDriverName 2. Parent display's effectiveRpcDriverName (for nested displays) 3. Track config's rpcDriverName                                                                                                                                                                                                                                                                                                                                                            |
| [DisplayMessageComponent](#getter-displaymessagecomponent)         | Getters    | [BaseDisplay](../basedisplay)                 | if a display-level message should be displayed instead, make this return a react component                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [renderingProps](#method-renderingprops)                           | Methods    | [BaseDisplay](../basedisplay)                 | props passed to the renderer's React "Rendering" component. these are client-side only and never sent to the worker. includes displayModel and callbacks                                                                                                                                                                                                                                                                                                                                                                                                               |
| [regionCannotBeRendered](#method-regioncannotberendered)           | Methods    | [BaseDisplay](../basedisplay)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [setStatusMessage](#action-setstatusmessage)                       | Actions    | [BaseDisplay](../basedisplay)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [setError](#action-seterror)                                       | Actions    | [BaseDisplay](../basedisplay)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [setRpcDriverName](#action-setrpcdrivername)                       | Actions    | [BaseDisplay](../basedisplay)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [scrollTop](#volatile-scrolltop)                                   | Volatiles  | [TrackHeightMixin](../trackheightmixin)       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [height](#getter-height)                                           | Getters    | [TrackHeightMixin](../trackheightmixin)       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [setScrollTop](#action-setscrolltop)                               | Actions    | [TrackHeightMixin](../trackheightmixin)       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [setHeight](#action-setheight)                                     | Actions    | [TrackHeightMixin](../trackheightmixin)       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [resizeHeight](#action-resizeheight)                               | Actions    | [TrackHeightMixin](../trackheightmixin)       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [userByteSizeLimit](#property-userbytesizelimit)                   | Properties | [RegionTooLargeMixin](../regiontoolargemixin) | user-confirmed byte limit after a force-load, disabling the gate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [regionTooLargeState](#volatile-regiontoolargestate)               | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [regionTooLargeReasonState](#volatile-regiontoolargereasonstate)   | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [featureDensityStats](#volatile-featuredensitystats)               | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [regionTooLarge](#getter-regiontoolarge)                           | Getters    | [RegionTooLargeMixin](../regiontoolargemixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [regionTooLargeReason](#getter-regiontoolargereason)               | Getters    | [RegionTooLargeMixin](../regiontoolargemixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [regionCannotBeRenderedText](#method-regioncannotberenderedtext)   | Methods    | [RegionTooLargeMixin](../regiontoolargemixin) | Plaintext reason (for SVG export); the on-screen too-large UI is rendered by the display chrome via `TooLargeMessage`, not the model.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [setRegionTooLarge](#action-setregiontoolarge)                     | Actions    | [RegionTooLargeMixin](../regiontoolargemixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [setFeatureDensityStats](#action-setfeaturedensitystats)           | Actions    | [RegionTooLargeMixin](../regiontoolargemixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [setFeatureDensityStatsLimit](#action-setfeaturedensitystatslimit) | Actions    | [RegionTooLargeMixin](../regiontoolargemixin) | force-load: raise the byte limit past the current request and clear the too-large banner                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [forceLoad](#action-forceload)                                     | Actions    | [RegionTooLargeMixin](../regiontoolargemixin) | Raises the byte limit past the current density stats and triggers a reload. The display chrome calls this via TooLargeMessage's force-load button; concrete display models override reload() to do the actual refetch.                                                                                                                                                                                                                                                                                                                                                 |

### LinearPairedArcDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/linearpairedarcdisplay).

<details>
<summary>LinearPairedArcDisplay - Properties</summary>

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

<details>
<summary>LinearPairedArcDisplay - Volatiles</summary>

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
<summary>LinearPairedArcDisplay - Getters</summary>

#### getter: conf

the config typed off the concrete schema; `ConfigurationReference` erases
`self.configuration` to `any`, so reads route through this to stay typed (same
move as `BaseAdapter<CONF>`)

```ts
type conf = ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>
```

#### getter: lineWidth

arc stroke width in px, from the promotable `lineWidth` slot (track-menu slider
writes it); flat across all arcs

```ts
type lineWidth = number
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

per-arc styling and endpoint pairs (one per ALT), evaluated once when
features/config change. Keeps the color jexl and makeFeaturePair (which runs
parseSvAlt) out of the per-pan render loop. Deduped on a canonical endpoint-pair
key: a paired feature is emitted from both endpoints and reciprocal BNDs arrive
as two records, so the same arc otherwise draws twice whenever both endpoints
are in the fetched regions.

```ts
type arcStyles =
  | {
      k1: { refName: string; start: number; end: number; mateDirection: number }
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

<details>
<summary>LinearPairedArcDisplay - Methods</summary>

#### method: trackMenuItems

```ts
type trackMenuItems = () => MenuItem[]
```

</details>

<details>
<summary>LinearPairedArcDisplay - Actions</summary>

#### action: setLineWidth

set arc stroke width; `undefined` resets to the config-slot default

```ts
type setLineWidth = (n?: number | undefined) => void
```

#### action: reload

retry after an error: clearing `error` re-fires the (error-gated) fetch autorun.
The shared `DisplayErrorBar` retry calls this; the base `reload` is a no-op,
which would leave the display stuck on error.

```ts
type reload = () => void
```

</details>

<details>
<summary>LinearPairedArcDisplay - Actions (other undocumented members)</summary>

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

#### action: renderSvg

```ts
type renderSvg = (
  opts?: ExportSvgDisplayOptions | undefined,
) => Promise<ReactNode>
```

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from BaseDisplay</summary>

[BaseDisplay →](../basedisplay)

**Properties**

#### property: id

```ts
// type signature
type id = IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: rpcDriverName

```ts
// type signature
type rpcDriverName = IMaybe<ISimpleType<string>>
// code
rpcDriverName: types.maybe(types.string)
```

**Volatiles**

#### volatile: error

```ts
// type signature
type error = unknown
// code
error: undefined as unknown
```

#### volatile: statusMessage

```ts
// type signature
type statusMessage = string | undefined
// code
statusMessage: undefined as string | undefined
```

#### volatile: statusProgress

determinate progress fraction [0,1] for the current status, or undefined when
the in-flight phase is indeterminate. Set alongside `statusMessage` by
`setStatusMessage`; a display that never shows a bar simply leaves it undefined.

```ts
// type signature
type statusProgress = number | undefined
// code
statusProgress: undefined as number | undefined
```

**Getters**

#### getter: parentTrack

```ts
type parentTrack = AbstractTrackModel
```

#### getter: parentDisplay

Returns the parent display if this display is nested within another display
(e.g., PileupDisplay inside LinearAlignmentsDisplay)

```ts
type parentDisplay =
  | { type?: string | undefined; effectiveRpcDriverName?: string | undefined }
  | undefined
```

#### getter: RenderingComponent

```ts
type RenderingComponent = FC<{ model: ModelInstanceTypeProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; type: ISimpleType<string>; rpcDriverName: IMaybe<ISimpleType<string>>; }> & { ...; } & { ...; } & IStateTreeNode<...>; onHorizontalScroll?: ((distance: number) => void) | undefined; blockState?: Record<...> | undefined; }>
```

#### getter: DisplayBlurb

```ts
type DisplayBlurb = FC<{ model: ModelInstanceTypeProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; type: ISimpleType<string>; rpcDriverName: IMaybe<ISimpleType<string>>; }> & { ...; } & { ...; } & IStateTreeNode<...>; }> | null
```

#### getter: adapterConfig

```ts
type adapterConfig = any
```

#### getter: isMinimized

Returns true if the parent track is minimized. Used to skip expensive operations
like autoruns when track is not visible.

```ts
type isMinimized = boolean
```

#### getter: effectiveRpcDriverName

Returns the effective RPC driver name with hierarchical fallback:

1. This display's explicit rpcDriverName
2. Parent display's effectiveRpcDriverName (for nested displays)
3. Track config's rpcDriverName

```ts
type effectiveRpcDriverName = any
```

#### getter: DisplayMessageComponent

if a display-level message should be displayed instead, make this return a react
component

```ts
type DisplayMessageComponent = FC<any> | undefined
```

**Methods**

#### method: renderingProps

props passed to the renderer's React "Rendering" component. these are
client-side only and never sent to the worker. includes displayModel and
callbacks

```ts
type renderingProps = () => { displayModel: ModelInstanceTypeProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; type: ISimpleType<string>; rpcDriverName: IMaybe<ISimpleType<string>>; }> & { ...; } & { ...; } & { ...; } & IStateTreeNode<...>; }
```

#### method: regionCannotBeRendered

```ts
type regionCannotBeRendered = () => null
```

**Actions**

#### action: setStatusMessage

```ts
type setStatusMessage = (status?: RpcStatus | undefined) => void
```

#### action: setError

```ts
type setError = (error?: unknown) => void
```

#### action: setRpcDriverName

```ts
type setRpcDriverName = (rpcDriverName: string) => void
```

</details>

<details>
<summary>Derived from TrackHeightMixin</summary>

[TrackHeightMixin →](../trackheightmixin)

**Volatiles**

#### volatile: scrollTop

```ts
// type signature
type scrollTop = number
// code
scrollTop: 0
```

**Getters**

#### getter: height

```ts
type height = number
```

**Actions**

#### action: setScrollTop

```ts
type setScrollTop = (scrollTop: number) => void
```

#### action: setHeight

```ts
type setHeight = (displayHeight: number) => number
```

#### action: resizeHeight

```ts
type resizeHeight = (distance: number) => number
```

</details>

<details>
<summary>Derived from RegionTooLargeMixin</summary>

[RegionTooLargeMixin →](../regiontoolargemixin)

**Properties**

#### property: userByteSizeLimit

user-confirmed byte limit after a force-load, disabling the gate

```ts
// type signature
type userByteSizeLimit = IMaybe<ISimpleType<number>>
// code
userByteSizeLimit: types.maybe(types.number)
```

**Volatiles**

#### volatile: regionTooLargeState

```ts
// type signature
type regionTooLargeState = false
// code
regionTooLargeState: false
```

#### volatile: regionTooLargeReasonState

```ts
// type signature
type regionTooLargeReasonState = string
// code
regionTooLargeReasonState: ''
```

#### volatile: featureDensityStats

```ts
// type signature
type featureDensityStats = FeatureDensityStats | undefined
// code
featureDensityStats: undefined as FeatureDensityStats | undefined
```

**Getters**

#### getter: regionTooLarge

```ts
type regionTooLarge = boolean
```

#### getter: regionTooLargeReason

```ts
type regionTooLargeReason = string
```

**Methods**

#### method: regionCannotBeRenderedText

Plaintext reason (for SVG export); the on-screen too-large UI is rendered by the
display chrome via `TooLargeMessage`, not the model.

```ts
type regionCannotBeRenderedText = () => '' | 'Force load to see features'
```

**Actions**

#### action: setRegionTooLarge

```ts
type setRegionTooLarge = (val: boolean, reason?: string | undefined) => void
```

#### action: setFeatureDensityStats

```ts
type setFeatureDensityStats = (stats?: FeatureDensityStats | undefined) => void
```

#### action: setFeatureDensityStatsLimit

force-load: raise the byte limit past the current request and clear the
too-large banner

```ts
type setFeatureDensityStatsLimit = (
  stats?: FeatureDensityStats | undefined,
) => void
```

#### action: forceLoad

Raises the byte limit past the current density stats and triggers a reload. The
display chrome calls this via TooLargeMessage's force-load button; concrete
display models override reload() to do the actual refetch.

```ts
type forceLoad = () => void
```

</details>
