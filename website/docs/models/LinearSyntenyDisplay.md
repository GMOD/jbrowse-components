---
id: linearsyntenydisplay
title: LinearSyntenyDisplay
sidebar_label: Display -> LinearSyntenyDisplay
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`linear-comparative-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LinearSyntenyDisplay/model.ts).

## Example usage

A complete `SyntenyTrack` config to paste into `tracks`. The adapter needs the
query (first) and target (second) assembly names, matched by the track's
`assemblyNames`:

```js
{
  type: 'SyntenyTrack',
  trackId: 'hg38_vs_mm10',
  name: 'hg38 vs mm10',
  assemblyNames: ['hg38', 'mm10'],
  adapter: {
    type: 'PAFAdapter',
    uri: 'https://example.com/hg38_vs_mm10.paf',
    queryAssembly: 'hg38',
    targetAssembly: 'mm10',
  },
  displays: [
    {
      type: 'LinearSyntenyDisplay',
      displayId: 'hg38_vs_mm10-LinearSyntenyDisplay',
    },
  ],
}
```

## Overview

Pure-data model. The containing LinearSyntenyView owns the shared GPU backend,
the upload autorun (which watches every display's `instanceData` and keys it by
`displayKey`), and the render autorun. This display only carries per-track state
and the `renderParams` the view reads out.

## Members

| Member                                                     | Kind       | Defined by                    | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------- | ---------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [type](#property-type)                                     | Properties | LinearSyntenyDisplay          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [configuration](#property-configuration)                   | Properties | LinearSyntenyDisplay          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [featureData](#volatile-featuredata)                       | Volatiles  | LinearSyntenyDisplay          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [instanceData](#volatile-instancedata)                     | Volatiles  | LinearSyntenyDisplay          | Raw GPU-instance geometry produced by the RPC. The view observes this on every display and uploads it to the shared backend keyed by `displayKey`. Clearing it (undefined) triggers backend eviction.                                                                                                                                                                                                                                                                                                                                                                                             |
| [hoveredFeatureIdx](#volatile-hoveredfeatureidx)           | Volatiles  | LinearSyntenyDisplay          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [clickedFeatureIdx](#volatile-clickedfeatureidx)           | Volatiles  | LinearSyntenyDisplay          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [contextMenuAnchor](#volatile-contextmenuanchor)           | Volatiles  | LinearSyntenyDisplay          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [fetching](#volatile-fetching)                             | Volatiles  | LinearSyntenyDisplay          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [loadedFetchKey](#volatile-loadedfetchkey)                 | Volatiles  | LinearSyntenyDisplay          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [assembliesSwapped](#volatile-assembliesswapped)           | Volatiles  | LinearSyntenyDisplay          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [parentHelper](#getter-parenthelper)                       | Getters    | LinearSyntenyDisplay          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [level](#getter-level)                                     | Getters    | LinearSyntenyDisplay          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [displayKey](#getter-displaykey)                           | Getters    | LinearSyntenyDisplay          | Stable backend key under the view-shared backend.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [height](#getter-height)                                   | Getters    | LinearSyntenyDisplay          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [adapterConfig](#getter-adapterconfig)                     | Getters    | LinearSyntenyDisplay          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [numFeats](#getter-numfeats)                               | Getters    | LinearSyntenyDisplay          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [presentCigarKinds](#getter-presentcigarkinds)             | Getters    | LinearSyntenyDisplay          | Which CIGAR indel ops are actually painted in the current geometry. The worker only emits an indel instance for an op wide enough to draw (sub-pixel indels are dropped), so a set bit means a visible-width op of that kind is on screen. The legend keys its indel chips off this rather than the coarse "file has any CIGAR" flag, so whole-genome zoom (every indel sub-pixel) shows no dead insertion/deletion swatch.                                                                                                                                                                       |
| [warnings](#getter-warnings)                               | Getters    | LinearSyntenyDisplay          | Warnings surfaced in the view header. Flags a likely reversed assembly row order, detected once at view load (only when the two assemblies have distinct chromosome names).                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [ready](#getter-ready)                                     | Getters    | LinearSyntenyDisplay          | A fetch has completed (data is present, even if it mapped zero features). Not `numFeats > 0` — an empty-but-finished fetch is ready, otherwise an empty result spins the loading overlay forever.                                                                                                                                                                                                                                                                                                                                                                                                 |
| [loading](#getter-loading)                                 | Getters    | LinearSyntenyDisplay          | First load: a fetch is running and no data has arrived yet. Excludes error so error UI and loading UI never show simultaneously. Drives the full striped LoadingOverlay.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [refetching](#getter-refetching)                           | Getters    | LinearSyntenyDisplay          | Refetch in-flight: a new fetch is running but stale ribbons are still on screen (e.g. zoom-out across a log2 bucket, region change). Drives a subtle corner indicator instead of the full overlay so the visible ribbons aren't masked on every viewport change.                                                                                                                                                                                                                                                                                                                                  |
| [currentFetchKey](#getter-currentfetchkey)                 | Getters    | LinearSyntenyDisplay          | Fetch-input signature (region set/order, snapped fetch window, zoom bucket, CIGAR/marker draw options, LOD tier) for the view's current state — the same tracked deps the fetch autorun refetches on. Reactive: flips the instant any of them changes. Before both connected views are ready it collapses to a degenerate signature (empty region sig, no fetch-window/zoom keys) that no connected fetch can produce — a real fetch requires non-empty displayedRegions — so `dataCurrent` reads false until a real fetch lands. Non-nullable so it mirrors dotplot's.                           |
| [dataCurrent](#getter-datacurrent)                         | Getters    | LinearSyntenyDisplay          | True when the rendered data was fetched for the view's current inputs. Goes false the instant a region/zoom/draw-option change makes the held ribbons stale — including during the pre-refetch debounce gap where `fetching` is still false so `refetching` alone can't catch it. The synteny analog of LGV's `viewportWithinLoadedData` and arc's `loadedRegionSignature === currentRegionSignature`.                                                                                                                                                                                            |
| [svgReady](#getter-svgready)                               | Getters    | LinearSyntenyDisplay          | Off-screen SVG export gate (see agent-docs/ARCHITECTURE.md, "svgReady"). Synteny is not an LGV display — it composes only `BaseDisplay` with its own fetch — so it has no `MultiRegionDisplayMixin`/`GlobalDataDisplayMixin` `svgReady`; this is the equivalent. Stale-safe on both axes: `dataCurrent` closes the pre-refetch debounce gap (stale window before `fetching` flips) and `!refetching` covers the in-flight RPC, so an export fired right after a zoom/pan waits for fresh ribbons instead of capturing stale ones. No `regionTooLarge` state (synteny never gates on region size). |
| [view](#getter-view)                                       | Getters    | LinearSyntenyDisplay          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [computedColors](#getter-computedcolors)                   | Getters    | LinearSyntenyDisplay          | Main-thread-computed per-instance colors. Recomputes whenever colorBy, featureData, or instanceData descriptors change — this is the gpuProps half of the rpcProps/gpuProps split. colorBy changes flow through here without touching the RPC.                                                                                                                                                                                                                                                                                                                                                    |
| [effectiveColorBy](#getter-effectivecolorby)               | Getters    | LinearSyntenyDisplay          | The view-level colorBy resolved for this specific level. 'reference' is a stacked-view mode that colors every level by the shared anchor assembly's chromosome names; each level maps it to 'query' or 'target' depending on which of its two assemblies is the anchor, so the coloring stays consistent across levels. Every other mode passes through.                                                                                                                                                                                                                                          |
| [renderInstanceData](#getter-renderinstancedata)           | Getters    | LinearSyntenyDisplay          | Instance data with main-thread-computed colors substituted in. The view's upload autorun reads this, so any colorBy change re-fires upload without an RPC round-trip.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [tooltipText](#getter-tooltiptext)                         | Getters    | LinearSyntenyDisplay          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [connectedViews](#getter-connectedviews)                   | Getters    | LinearSyntenyDisplay          | The two adjacent genome views this level draws between, or undefined until both are initialized with regions. A level draws between an adjacent pair, so both render and fetch depend only on those two views, not the whole stack. Single source of truth for that gate.                                                                                                                                                                                                                                                                                                                         |
| [bpPerPxBucketKey](#getter-bpperpxbucketkey)               | Getters    | LinearSyntenyDisplay          | Stable key over the log2 zoom bucket of both connected views. The fetch autorun tracks this (a computed compares its string output) instead of raw bpPerPx, so it only refetches when zoom crosses a half-decade rather than on every settled zoom within a bucket.                                                                                                                                                                                                                                                                                                                               |
| [fetchRegionsKey](#getter-fetchregionskey)                 | Getters    | LinearSyntenyDisplay          | Stable key over the _snapped_ fetch window of both connected views. The fetch autorun tracks this so a scroll/zoom that moves the snapped window refetches, while a sub-buffer pan (identical snapped window) does not — a MobX computed only notifies when its string output changes. Mirrors the window syntenyFetchRegions hands the worker.                                                                                                                                                                                                                                                   |
| [renderParams](#getter-renderparams)                       | Getters    | LinearSyntenyDisplay          | Per-track render params consumed by the view's aggregator. The view substitutes yTop before handing this to the backend.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [getFeature](#method-getfeature)                           | Methods    | LinearSyntenyDisplay          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [setRpcData](#action-setrpcdata)                           | Actions    | LinearSyntenyDisplay          | Set both feature and instance data in one MST action so downstream autoruns (upload, render) fire once per RPC completion, not twice.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [setFetching](#action-setfetching)                         | Actions    | LinearSyntenyDisplay          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [setAssembliesSwapped](#action-setassembliesswapped)       | Actions    | LinearSyntenyDisplay          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [setHoveredFeatureIdx](#action-sethoveredfeatureidx)       | Actions    | LinearSyntenyDisplay          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [setClickedFeatureIdx](#action-setclickedfeatureidx)       | Actions    | LinearSyntenyDisplay          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [openContextMenu](#action-opencontextmenu)                 | Actions    | LinearSyntenyDisplay          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [closeContextMenu](#action-closecontextmenu)               | Actions    | LinearSyntenyDisplay          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [id](#property-id)                                         | Properties | [BaseDisplay](../basedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [rpcDriverName](#property-rpcdrivername)                   | Properties | [BaseDisplay](../basedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [error](#volatile-error)                                   | Volatiles  | [BaseDisplay](../basedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [statusMessage](#volatile-statusmessage)                   | Volatiles  | [BaseDisplay](../basedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [statusProgress](#volatile-statusprogress)                 | Volatiles  | [BaseDisplay](../basedisplay) | determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate. Set alongside `statusMessage` by `setStatusMessage`; a display that never shows a bar simply leaves it undefined.                                                                                                                                                                                                                                                                                                                                                             |
| [parentTrack](#getter-parenttrack)                         | Getters    | [BaseDisplay](../basedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [parentDisplay](#getter-parentdisplay)                     | Getters    | [BaseDisplay](../basedisplay) | Returns the parent display if this display is nested within another display (e.g., PileupDisplay inside LinearAlignmentsDisplay)                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [RenderingComponent](#getter-renderingcomponent)           | Getters    | [BaseDisplay](../basedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [DisplayBlurb](#getter-displayblurb)                       | Getters    | [BaseDisplay](../basedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [isMinimized](#getter-isminimized)                         | Getters    | [BaseDisplay](../basedisplay) | Returns true if the parent track is minimized. Used to skip expensive operations like autoruns when track is not visible.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [effectiveRpcDriverName](#getter-effectiverpcdrivername)   | Getters    | [BaseDisplay](../basedisplay) | Returns the effective RPC driver name with hierarchical fallback: 1. This display's explicit rpcDriverName 2. Parent display's effectiveRpcDriverName (for nested displays) 3. Track config's rpcDriverName                                                                                                                                                                                                                                                                                                                                                                                       |
| [DisplayMessageComponent](#getter-displaymessagecomponent) | Getters    | [BaseDisplay](../basedisplay) | if a display-level message should be displayed instead, make this return a react component                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [renderingProps](#method-renderingprops)                   | Methods    | [BaseDisplay](../basedisplay) | props passed to the renderer's React "Rendering" component. these are client-side only and never sent to the worker. includes displayModel and callbacks                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [trackMenuItems](#method-trackmenuitems)                   | Methods    | [BaseDisplay](../basedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [regionCannotBeRendered](#method-regioncannotberendered)   | Methods    | [BaseDisplay](../basedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [setStatusMessage](#action-setstatusmessage)               | Actions    | [BaseDisplay](../basedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [setError](#action-seterror)                               | Actions    | [BaseDisplay](../basedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [setRpcDriverName](#action-setrpcdrivername)               | Actions    | [BaseDisplay](../basedisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [reload](#action-reload)                                   | Actions    | [BaseDisplay](../basedisplay) | base display reload does nothing, see specialized displays for details                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

### LinearSyntenyDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/linearsyntenydisplay).

<details>
<summary>LinearSyntenyDisplay - Properties</summary>

#### property: type

```ts
// type signature
type type = ISimpleType<'LinearSyntenyDisplay'>
// code
type: types.literal('LinearSyntenyDisplay')
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
<summary>LinearSyntenyDisplay - Volatiles</summary>

#### volatile: instanceData

Raw GPU-instance geometry produced by the RPC. The view observes this on every
display and uploads it to the shared backend keyed by `displayKey`. Clearing it
(undefined) triggers backend eviction.

```ts
// type signature
type instanceData = SyntenyGeometry | undefined
// code
instanceData: undefined as SyntenyGeometry | undefined
```

</details>

<details>
<summary>LinearSyntenyDisplay - Volatiles (other undocumented members)</summary>

#### volatile: featureData

```ts
// type signature
type featureData = SyntenyFeatureData | undefined
// code
featureData: undefined as SyntenyFeatureData | undefined
```

#### volatile: hoveredFeatureIdx

```ts
// type signature
type hoveredFeatureIdx = number
// code
hoveredFeatureIdx: -1
```

#### volatile: clickedFeatureIdx

```ts
// type signature
type clickedFeatureIdx = number
// code
clickedFeatureIdx: -1
```

#### volatile: contextMenuAnchor

```ts
// type signature
type contextMenuAnchor = ClickCoord | undefined
// code
contextMenuAnchor: undefined as ClickCoord | undefined
```

#### volatile: fetching

```ts
// type signature
type fetching = false
// code
fetching: false
```

#### volatile: loadedFetchKey

```ts
// type signature
type loadedFetchKey = string | undefined
// code
loadedFetchKey: undefined as string | undefined
```

#### volatile: assembliesSwapped

```ts
// type signature
type assembliesSwapped = false
// code
assembliesSwapped: false
```

</details>

<details>
<summary>LinearSyntenyDisplay - Getters</summary>

#### getter: displayKey

Stable backend key under the view-shared backend.

```ts
type displayKey = number
```

#### getter: presentCigarKinds

Which CIGAR indel ops are actually painted in the current geometry. The worker
only emits an indel instance for an op wide enough to draw (sub-pixel indels are
dropped), so a set bit means a visible-width op of that kind is on screen. The
legend keys its indel chips off this rather than the coarse "file has any CIGAR"
flag, so whole-genome zoom (every indel sub-pixel) shows no dead
insertion/deletion swatch.

```ts
type presentCigarKinds = number
```

#### getter: warnings

Warnings surfaced in the view header. Flags a likely reversed assembly row
order, detected once at view load (only when the two assemblies have distinct
chromosome names).

```ts
type warnings = { message: string; effect: string }[]
```

#### getter: ready

A fetch has completed (data is present, even if it mapped zero features). Not
`numFeats > 0` — an empty-but-finished fetch is ready, otherwise an empty result
spins the loading overlay forever.

```ts
type ready = boolean
```

#### getter: loading

First load: a fetch is running and no data has arrived yet. Excludes error so
error UI and loading UI never show simultaneously. Drives the full striped
LoadingOverlay.

```ts
type loading = boolean
```

#### getter: refetching

Refetch in-flight: a new fetch is running but stale ribbons are still on screen
(e.g. zoom-out across a log2 bucket, region change). Drives a subtle corner
indicator instead of the full overlay so the visible ribbons aren't masked on
every viewport change.

```ts
type refetching = boolean
```

#### getter: currentFetchKey

Fetch-input signature (region set/order, snapped fetch window, zoom bucket,
CIGAR/marker draw options, LOD tier) for the view's current state — the same
tracked deps the fetch autorun refetches on. Reactive: flips the instant any of
them changes. Before both connected views are ready it collapses to a degenerate
signature (empty region sig, no fetch-window/zoom keys) that no connected fetch
can produce — a real fetch requires non-empty displayedRegions — so
`dataCurrent` reads false until a real fetch lands. Non-nullable so it mirrors
dotplot's.

```ts
type currentFetchKey = string
```

#### getter: dataCurrent

True when the rendered data was fetched for the view's current inputs. Goes
false the instant a region/zoom/draw-option change makes the held ribbons stale
— including during the pre-refetch debounce gap where `fetching` is still false
so `refetching` alone can't catch it. The synteny analog of LGV's
`viewportWithinLoadedData` and arc's
`loadedRegionSignature === currentRegionSignature`.

```ts
type dataCurrent = boolean
```

#### getter: svgReady

Off-screen SVG export gate (see agent-docs/ARCHITECTURE.md, "svgReady"). Synteny
is not an LGV display — it composes only `BaseDisplay` with its own fetch — so
it has no `MultiRegionDisplayMixin`/`GlobalDataDisplayMixin` `svgReady`; this is
the equivalent. Stale-safe on both axes: `dataCurrent` closes the pre-refetch
debounce gap (stale window before `fetching` flips) and `!refetching` covers the
in-flight RPC, so an export fired right after a zoom/pan waits for fresh ribbons
instead of capturing stale ones. No `regionTooLarge` state (synteny never gates
on region size).

```ts
type svgReady = boolean
```

#### getter: computedColors

Main-thread-computed per-instance colors. Recomputes whenever colorBy,
featureData, or instanceData descriptors change — this is the gpuProps half of
the rpcProps/gpuProps split. colorBy changes flow through here without touching
the RPC.

```ts
type computedColors = Uint32Array<ArrayBuffer> | undefined
```

#### getter: effectiveColorBy

The view-level colorBy resolved for this specific level. 'reference' is a
stacked-view mode that colors every level by the shared anchor assembly's
chromosome names; each level maps it to 'query' or 'target' depending on which
of its two assemblies is the anchor, so the coloring stays consistent across
levels. Every other mode passes through.

```ts
type effectiveColorBy = SyntenyColorBy
```

#### getter: renderInstanceData

Instance data with main-thread-computed colors substituted in. The view's upload
autorun reads this, so any colorBy change re-fires upload without an RPC
round-trip.

```ts
type renderInstanceData = { colors: Uint32Array<ArrayBuffer>; bp1: Float32Array<ArrayBufferLike>; bp2: Float32Array<ArrayBufferLike>; ... 7 more ...; instanceCount: number; } | undefined
```

#### getter: connectedViews

The two adjacent genome views this level draws between, or undefined until both
are initialized with regions. A level draws between an adjacent pair, so both
render and fetch depend only on those two views, not the whole stack. Single
source of truth for that gate.

```ts
type connectedViews = { v0: ModelInstanceTypeProps<_OverrideProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<...>; }, { ...; }>, { ...; }>> & ... 20 more ... & IStateTreeNode<...>; v1: ModelInstanceTypeProps<...> & ... 20 more ... & IStateTree...
```

#### getter: bpPerPxBucketKey

Stable key over the log2 zoom bucket of both connected views. The fetch autorun
tracks this (a computed compares its string output) instead of raw bpPerPx, so
it only refetches when zoom crosses a half-decade rather than on every settled
zoom within a bucket.

```ts
type bpPerPxBucketKey = string | undefined
```

#### getter: fetchRegionsKey

Stable key over the _snapped_ fetch window of both connected views. The fetch
autorun tracks this so a scroll/zoom that moves the snapped window refetches,
while a sub-buffer pan (identical snapped window) does not — a MobX computed
only notifies when its string output changes. Mirrors the window
syntenyFetchRegions hands the worker.

```ts
type fetchRegionsKey = string | undefined
```

#### getter: renderParams

Per-track render params consumed by the view's aggregator. The view substitutes
yTop before handing this to the backend.

```ts
type renderParams =
  | {
      yTop: number
      height: number
      alpha: number
      fadeThinAlignments: boolean
      minAlignmentLength: number
      hoveredFeatureId: number
      clickedFeatureId: number
      offsetPx0: number
      offsetPx1: number
      bpPerPx0: number
      bpPerPx1: number
      drawCurves: boolean
    }
  | undefined
```

</details>

<details>
<summary>LinearSyntenyDisplay - Getters (other undocumented members)</summary>

#### getter: parentHelper

```ts
type parentHelper = { height: number; level: number }
```

#### getter: level

```ts
type level = number
```

#### getter: height

```ts
type height = number
```

#### getter: adapterConfig

```ts
type adapterConfig = any
```

#### getter: numFeats

```ts
type numFeats = number
```

#### getter: view

```ts
type view = ModelInstanceTypeProps<_OverrideProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>, { ...; }>> & ... 17 more ... & IStateTreeNode<...>
```

#### getter: tooltipText

```ts
type tooltipText = string
```

</details>

<details>
<summary>LinearSyntenyDisplay - Methods</summary>

#### method: getFeature

```ts
type getFeature = (index: number) => FeatPos | undefined
```

</details>

<details>
<summary>LinearSyntenyDisplay - Actions</summary>

#### action: setRpcData

Set both feature and instance data in one MST action so downstream autoruns
(upload, render) fire once per RPC completion, not twice.

```ts
type setRpcData = (
  featureData: SyntenyFeatureData | undefined,
  instanceData: SyntenyGeometry | undefined,
  fetchKey: string,
) => void
```

</details>

<details>
<summary>LinearSyntenyDisplay - Actions (other undocumented members)</summary>

#### action: setFetching

```ts
type setFetching = (arg: boolean) => void
```

#### action: setAssembliesSwapped

```ts
type setAssembliesSwapped = (arg: boolean) => void
```

#### action: setHoveredFeatureIdx

```ts
type setHoveredFeatureIdx = (idx: number) => void
```

#### action: setClickedFeatureIdx

```ts
type setClickedFeatureIdx = (idx: number) => void
```

#### action: openContextMenu

```ts
type openContextMenu = (anchor: ClickCoord) => void
```

#### action: closeContextMenu

```ts
type closeContextMenu = () => void
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

#### method: trackMenuItems

```ts
type trackMenuItems = () => MenuItem[]
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

#### action: reload

base display reload does nothing, see specialized displays for details

```ts
type reload = () => void
```

</details>
