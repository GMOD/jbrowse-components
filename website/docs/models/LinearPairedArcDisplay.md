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

| Member                                                             | Kind       | Defined by                                    | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------ | ---------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [type](#property-type)                                             | Properties | LinearPairedArcDisplay                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [configuration](#property-configuration)                           | Properties | LinearPairedArcDisplay                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [conf](#getter-conf)                                               | Getters    | LinearPairedArcDisplay                        | the config typed off the concrete schema; `ConfigurationReference` erases `self.configuration` to `any`, so reads route through this to stay typed (same move as `BaseAdapter<CONF>`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [configuredFetchSizeLimit](#getter-configuredfetchsizelimit)       | Getters    | LinearPairedArcDisplay                        | supplies the config read `ArcFetchModel`'s derived byte gate needs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [lineWidth](#getter-linewidth)                                     | Getters    | LinearPairedArcDisplay                        | arc stroke width in px, from the promotable `lineWidth` slot (track-menu slider writes it); flat across all arcs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [arcStyles](#getter-arcstyles)                                     | Getters    | LinearPairedArcDisplay                        | per-arc styling and endpoint pairs (one per ALT), evaluated once when features/config change. Keeps the color jexl and makeFeaturePair (which runs parseSvAlt) out of the per-pan render loop. Deduped on a canonical endpoint-pair key: a paired feature is emitted from both endpoints and reciprocal BNDs arrive as two records, so the same arc otherwise draws twice whenever both endpoints are in the fetched regions.                                                                                                                                                                                                                                                                            |
| [trackMenuItems](#method-trackmenuitems)                           | Methods    | LinearPairedArcDisplay                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [selectFeature](#action-selectfeature)                             | Actions    | LinearPairedArcDisplay                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setLineWidth](#action-setlinewidth)                               | Actions    | LinearPairedArcDisplay                        | set arc stroke width; `undefined` resets to the config-slot default                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [renderSvg](#action-rendersvg)                                     | Actions    | LinearPairedArcDisplay                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [id](#property-id)                                                 | Properties | [BaseDisplay](../basedisplay)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [rpcDriverName](#property-rpcdrivername)                           | Properties | [BaseDisplay](../basedisplay)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [ignorePromotedDefaults](#property-ignorepromoteddefaults)         | Properties | [BaseDisplay](../basedisplay)                 | true for a display that arrived inside a session received from someone else (a share link, an encoded/json session, a `spec-` URL). Such a display resolves its `promotable` config slots from its own config only, never from this browser's promoted display-type defaults (see `configuration/promotableDefaults.ts`) — the received session is a record of what the sender saw, and a local preference silently repainting it would make it a lie. A track opened _afterwards_ in that same session is a fresh track of this user's, so it never gets the flag and picks up their defaults normally. Cleared by `resetSlotsToInherit` when the user deliberately makes the display follow a default. |
| [error](#volatile-error)                                           | Volatiles  | [BaseDisplay](../basedisplay)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [statusMessage](#volatile-statusmessage)                           | Volatiles  | [BaseDisplay](../basedisplay)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [statusProgress](#volatile-statusprogress)                         | Volatiles  | [BaseDisplay](../basedisplay)                 | determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate. Set alongside `statusMessage` by `setStatusMessage`; a display that never shows a bar simply leaves it undefined.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [parentTrack](#getter-parenttrack)                                 | Getters    | [BaseDisplay](../basedisplay)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [parentDisplay](#getter-parentdisplay)                             | Getters    | [BaseDisplay](../basedisplay)                 | Returns the parent display if this display is nested within another display (e.g., PileupDisplay inside LinearAlignmentsDisplay)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [RenderingComponent](#getter-renderingcomponent)                   | Getters    | [BaseDisplay](../basedisplay)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [DisplayBlurb](#getter-displayblurb)                               | Getters    | [BaseDisplay](../basedisplay)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [adapterConfig](#getter-adapterconfig)                             | Getters    | [BaseDisplay](../basedisplay)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [isMinimized](#getter-isminimized)                                 | Getters    | [BaseDisplay](../basedisplay)                 | Returns true if the parent track is minimized. Used to skip expensive operations like autoruns when track is not visible.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [effectiveRpcDriverName](#getter-effectiverpcdrivername)           | Getters    | [BaseDisplay](../basedisplay)                 | Returns the effective RPC driver name with hierarchical fallback: 1. This display's explicit rpcDriverName 2. Parent display's effectiveRpcDriverName (for nested displays) 3. Track config's rpcDriverName                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [DisplayMessageComponent](#getter-displaymessagecomponent)         | Getters    | [BaseDisplay](../basedisplay)                 | if a display-level message should be displayed instead, make this return a react component                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [renderingProps](#method-renderingprops)                           | Methods    | [BaseDisplay](../basedisplay)                 | props passed to the renderer's React "Rendering" component. these are client-side only and never sent to the worker. includes displayModel and callbacks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [regionCannotBeRendered](#method-regioncannotberendered)           | Methods    | [BaseDisplay](../basedisplay)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setIgnorePromotedDefaults](#action-setignorepromoteddefaults)     | Actions    | [BaseDisplay](../basedisplay)                 | see the `ignorePromotedDefaults` property                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [setStatusMessage](#action-setstatusmessage)                       | Actions    | [BaseDisplay](../basedisplay)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setError](#action-seterror)                                       | Actions    | [BaseDisplay](../basedisplay)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setRpcDriverName](#action-setrpcdrivername)                       | Actions    | [BaseDisplay](../basedisplay)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [reload](#action-reload)                                           | Actions    | [BaseDisplay](../basedisplay)                 | base display reload does nothing, see specialized displays for details                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [scrollTop](#volatile-scrolltop)                                   | Volatiles  | [TrackHeightMixin](../trackheightmixin)       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [height](#getter-height)                                           | Getters    | [TrackHeightMixin](../trackheightmixin)       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setScrollTop](#action-setscrolltop)                               | Actions    | [TrackHeightMixin](../trackheightmixin)       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setHeight](#action-setheight)                                     | Actions    | [TrackHeightMixin](../trackheightmixin)       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [resizeHeight](#action-resizeheight)                               | Actions    | [TrackHeightMixin](../trackheightmixin)       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [features](#volatile-features)                                     | Volatiles  | [ArcFetchModel](../arcfetchmodel)             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [loadedRegionSignature](#volatile-loadedregionsignature)           | Volatiles  | [ArcFetchModel](../arcfetchmodel)             | signature of the static-block region set `features` were fetched for; the `dataLoaded`/`svgReady` freshness axis (see regionSignature.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [byteEstimateVisibleBp](#volatile-byteestimatevisiblebp)           | Volatiles  | [ArcFetchModel](../arcfetchmodel)             | visibleBp when the current `featureDensityStats` estimate was captured, so the derived `regionTooLarge` getter can scale it to the current view                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [estimatedVisibleBytes](#getter-estimatedvisiblebytes)             | Getters    | [ArcFetchModel](../arcfetchmodel)             | cached byte estimate scaled from the span it was measured over to the current visible span, so the verdict self-releases on zoom-in                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [tooLargeStatus](#getter-toolargestatus)                           | Getters    | [ArcFetchModel](../arcfetchmodel)             | shared verdict + reason (AUTO_FORCE_LOAD_BP floor + bytes-over-limit), fed the scaled estimate — same helper as every other gating path                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [regionTooLarge](#getter-regiontoolarge)                           | Getters    | [ArcFetchModel](../arcfetchmodel)             | derived — shadows GlobalFetchMixin's imperative RegionTooLargeMixin getter                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [regionTooLargeReason](#getter-regiontoolargereason)               | Getters    | [ArcFetchModel](../arcfetchmodel)             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [dataLoaded](#getter-dataloaded)                                   | Getters    | [ArcFetchModel](../arcfetchmodel)             | fresh only when `features` were fetched for the current static-block set; overrides GlobalFetchMixin's default so `svgReady` can resolve on load                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setFeatures](#action-setfeatures)                                 | Actions    | [ArcFetchModel](../arcfetchmodel)             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setFeatureDensityStats](#action-setfeaturedensitystats)           | Actions    | [ArcFetchModel](../arcfetchmodel)             | Records the span the byte estimate was measured at so `estimatedVisibleBytes` can scale it to the current view.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setFeatureDensityStatsLimit](#action-setfeaturedensitystatslimit) | Actions    | [ArcFetchModel](../arcfetchmodel)             | Force-load raises the byte gate past the estimate scaled to the _current_ view (shared helper), not the raw captured bytes, so it clears even if the view zoomed out after the estimate was captured.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [reloadCounter](#volatile-reloadcounter)                           | Volatiles  | [GlobalFetchMixin](../globalfetchmixin)       | Bumped by `reload()` to retrigger a global display's fetch autorun. Each display reads `void self.reloadCounter` in its `afterAttach` fetch autorun so a user-initiated reload re-runs the fetch even when no viewport/setting changed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [svgReadyExtraTerminal](#getter-svgreadyextraterminal)             | Getters    | [GlobalFetchMixin](../globalfetchmixin)       | Overridable hook (default false): a subclass returns true to mark an extra terminal state where off-screen export can proceed with no loaded data (mirrors `MultiRegionDisplayMixin.svgReadyExtraTerminal`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [svgReady](#getter-svgready)                                       | Getters    | [GlobalFetchMixin](../globalfetchmixin)       | Global-display analog of `MultiRegionDisplayMixin.svgReady`: true once an off-screen (SVG) export can read final data. Like that mixin it requires the dataset to actually be loaded (or a terminal error / too-large / extra state), NOT merely "not currently fetching": the fetch trigger is a debounced `afterAttach` autorun, so at export time `isLoading` can still be false with no data yet — a `displayPhase !== 'loading'` test would then capture an empty render. Never gates on `canvasDrawn`, which an off-screen export never sets. Off-screen renderers gate on it via `awaitSvgReady(model)`.                                                                                          |
| [userByteSizeLimit](#property-userbytesizelimit)                   | Properties | [RegionTooLargeMixin](../regiontoolargemixin) | user-confirmed byte limit after a force-load, disabling the gate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [regionTooLargeState](#volatile-regiontoolargestate)               | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [regionTooLargeReasonState](#volatile-regiontoolargereasonstate)   | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [featureDensityStats](#volatile-featuredensitystats)               | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [regionCannotBeRenderedText](#method-regioncannotberenderedtext)   | Methods    | [RegionTooLargeMixin](../regiontoolargemixin) | Plaintext reason (for SVG export); the on-screen too-large UI is rendered by the display chrome via `TooLargeMessage`, not the model.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [setRegionTooLarge](#action-setregiontoolarge)                     | Actions    | [RegionTooLargeMixin](../regiontoolargemixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [forceLoad](#action-forceload)                                     | Actions    | [RegionTooLargeMixin](../regiontoolargemixin) | Raises the byte limit past the current density stats and triggers a reload. The display chrome calls this via TooLargeMessage's force-load button; concrete display models override reload() to do the actual refetch.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [activeStopToken](#volatile-activestoptoken)                       | Volatiles  | [FetchMixin](../fetchmixin)                   | stop token of the in-flight fetch, or undefined when idle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [fetchGeneration](#volatile-fetchgeneration)                       | Volatiles  | [FetchMixin](../fetchmixin)                   | bumps at every fetch end; autoruns read it to re-evaluate, and it doubles as the staleness epoch inside runFetch                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [fetchCanceled](#volatile-fetchcanceled)                           | Volatiles  | [FetchMixin](../fetchmixin)                   | true after the user explicitly cancels a load (the loading overlay's cancel button → `cancelFetchByUser`). A durable, blocking state — unlike `cancelFetch`, it does not retrigger the fetch autoruns — so the load stays stopped until the user retries (`reload`) or the viewport changes. Any new fetch clears it (`runFetch` resets it at the start).                                                                                                                                                                                                                                                                                                                                                |
| [regionStatuses](#volatile-regionstatuses)                         | Volatiles  | [FetchMixin](../fetchmixin)                   | latest status of each concurrent in-flight operation, keyed by an arbitrary id (the canvas display uses displayedRegionIndex). Plain bookkeeping — not read reactively; setRegionStatus derives the observable statusMessage/statusProgress from it on every update so N parallel region fetches aggregate into one bar instead of clobbering.                                                                                                                                                                                                                                                                                                                                                           |
| [lastStatusMs](#volatile-laststatusms)                             | Volatiles  | [FetchMixin](../fetchmixin)                   | Date.now() of the last applied status write; the status callbacks gate on it to throttle a high-frequency progress stream.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [isLoading](#getter-isloading)                                     | Getters    | [FetchMixin](../fetchmixin)                   | true while a fetch is active                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [makeStatusCallback](#method-makestatuscallback)                   | Methods    | [FetchMixin](../fetchmixin)                   | An RPC `statusCallback` bound to this display: forwards progress to the shared `statusMessage`, guarded by `isAlive` so a callback that fires after the node is torn down (RPCs resolve their status stream asynchronously) is a safe no-op. Pass directly as the `statusCallback` RPC arg instead of re-inlining the guard at every call site.                                                                                                                                                                                                                                                                                                                                                          |
| [makeRegionStatusCallback](#method-makeregionstatuscallback)       | Methods    | [FetchMixin](../fetchmixin)                   | Per-region variant of `makeStatusCallback`: routes progress through `setRegionStatus(key, …)` so N concurrent per-region fetches aggregate into one status bar instead of clobbering each other. Same `isAlive` guard.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [throttleStatus](#action-throttlestatus)                           | Actions    | [FetchMixin](../fetchmixin)                   | Run `apply` only if at least `STATUS_THROTTLE_MS` has passed since the last status write. A leading-edge throttle: sparse updates pass straight through, dense progress bursts are thinned so the loading overlay stops re-rendering faster than the view animates. The final status doesn't need a trailing flush — fetch completion clears it via `resetStatus`.                                                                                                                                                                                                                                                                                                                                       |
| [resetStatus](#action-resetstatus)                                 | Actions    | [FetchMixin](../fetchmixin)                   | Drop the active stop token and clear all status bookkeeping. Shared by both cancel paths and runFetch's cleanup.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [stopActiveFetch](#action-stopactivefetch)                         | Actions    | [FetchMixin](../fetchmixin)                   | Abort the in-flight fetch (if any) and clear its status. The shared preamble of both cancel paths; the difference between them is only what they do to `fetchCanceled` / `fetchGeneration` afterward.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [setRegionStatus](#action-setregionstatus)                         | Actions    | [FetchMixin](../fetchmixin)                   | Record one concurrent operation's latest status (keyed) and recompute the shared statusMessage/statusProgress as the aggregate across all in-flight keys. Pass undefined to drop a key. Used by displays that fan a single fetch out into parallel per-region RPCs.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [cancelFetch](#action-cancelfetch)                                 | Actions    | [FetchMixin](../fetchmixin)                   | cancel any in-flight fetch and bump fetchGeneration (always bumps, so callers can retrigger fetch autoruns even when nothing was in flight). This is the _internal_ reset used by clearAllRpcData/invalidateLoadedRegions — it clears any user-cancel flag so the retrigger actually re-fetches.                                                                                                                                                                                                                                                                                                                                                                                                         |
| [cancelFetchByUser](#action-cancelfetchbyuser)                     | Actions    | [FetchMixin](../fetchmixin)                   | User-initiated cancel from the loading overlay. Stops the in-flight fetch and lands in a durable `fetchCanceled` state. Unlike `cancelFetch`, it does NOT bump fetchGeneration — so the fetch autoruns don't immediately restart the load. The user retries via `reload` (the overlay's retry button), or it clears on the next viewport change.                                                                                                                                                                                                                                                                                                                                                         |
| [runFetch](#action-runfetch)                                       | Actions    | [FetchMixin](../fetchmixin)                   | Run a cancel-safe fetch (cancels any prior). The work callback gets a FetchContext with a stopToken to forward to the RPC and an isStale() check to short-circuit commits once the user has moved on. Abort errors are swallowed; others are stored in `error` if not stale.                                                                                                                                                                                                                                                                                                                                                                                                                             |

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
<summary>LinearPairedArcDisplay - Getters</summary>

#### getter: conf

the config typed off the concrete schema; `ConfigurationReference` erases
`self.configuration` to `any`, so reads route through this to stay typed (same
move as `BaseAdapter<CONF>`)

```ts
type conf = ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>
```

#### getter: configuredFetchSizeLimit

supplies the config read `ArcFetchModel`'s derived byte gate needs

```ts
type configuredFetchSizeLimit = any
```

#### getter: lineWidth

arc stroke width in px, from the promotable `lineWidth` slot (track-menu slider
writes it); flat across all arcs

```ts
type lineWidth = number
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

</details>

<details>
<summary>LinearPairedArcDisplay - Actions (other undocumented members)</summary>

#### action: selectFeature

```ts
type selectFeature = (feature: Feature) => void
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

#### property: ignorePromotedDefaults

true for a display that arrived inside a session received from someone else (a
share link, an encoded/json session, a `spec-` URL). Such a display resolves its
`promotable` config slots from its own config only, never from this browser's
promoted display-type defaults (see `configuration/promotableDefaults.ts`) — the
received session is a record of what the sender saw, and a local preference
silently repainting it would make it a lie. A track opened _afterwards_ in that
same session is a fresh track of this user's, so it never gets the flag and
picks up their defaults normally. Cleared by `resetSlotsToInherit` when the user
deliberately makes the display follow a default.

```ts
// type signature
type ignorePromotedDefaults = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
ignorePromotedDefaults: types.stripDefault(types.boolean, false)
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
type RenderingComponent = FC<{ model: ModelInstanceTypeProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; type: ISimpleType<string>; rpcDriverName: IMaybe<ISimpleType<string>>; ignorePromotedDefaults: IOptionalIType<...>; }> & { ...; } & { ...; } & IStateTreeNode<...>; onHorizontalScroll?: ((distance: number) => void) | undefined;...
```

#### getter: DisplayBlurb

```ts
type DisplayBlurb = FC<{ model: ModelInstanceTypeProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; type: ISimpleType<string>; rpcDriverName: IMaybe<ISimpleType<string>>; ignorePromotedDefaults: IOptionalIType<...>; }> & { ...; } & { ...; } & IStateTreeNode<...>; }> | null
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
type renderingProps = () => { displayModel: ModelInstanceTypeProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; type: ISimpleType<string>; rpcDriverName: IMaybe<ISimpleType<string>>; ignorePromotedDefaults: IOptionalIType<...>; }> & { ...; } & { ...; } & { ...; } & IStateTreeNode<...>; }
```

#### method: regionCannotBeRendered

```ts
type regionCannotBeRendered = () => null
```

**Actions**

#### action: setIgnorePromotedDefaults

see the `ignorePromotedDefaults` property

```ts
type setIgnorePromotedDefaults = (flag: boolean) => void
```

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
<summary>Derived from ArcFetchModel</summary>

[ArcFetchModel →](../arcfetchmodel)

**Volatiles**

#### volatile: features

```ts
// type signature
type features = Feature[] | undefined
// code
features: undefined as Feature[] | undefined
```

#### volatile: loadedRegionSignature

signature of the static-block region set `features` were fetched for; the
`dataLoaded`/`svgReady` freshness axis (see regionSignature.ts)

```ts
// type signature
type loadedRegionSignature = string | undefined
// code
loadedRegionSignature: undefined as string | undefined
```

#### volatile: byteEstimateVisibleBp

visibleBp when the current `featureDensityStats` estimate was captured, so the
derived `regionTooLarge` getter can scale it to the current view

```ts
// type signature
type byteEstimateVisibleBp = number | undefined
// code
byteEstimateVisibleBp: undefined as number | undefined
```

**Getters**

#### getter: estimatedVisibleBytes

cached byte estimate scaled from the span it was measured over to the current
visible span, so the verdict self-releases on zoom-in

```ts
type estimatedVisibleBytes = number | undefined
```

#### getter: tooLargeStatus

shared verdict + reason (AUTO_FORCE_LOAD_BP floor + bytes-over-limit), fed the
scaled estimate — same helper as every other gating path

```ts
type tooLargeStatus = RegionTooLargeStatus
```

#### getter: regionTooLarge

derived — shadows GlobalFetchMixin's imperative RegionTooLargeMixin getter

```ts
type regionTooLarge = boolean
```

#### getter: regionTooLargeReason

```ts
type regionTooLargeReason = string
```

#### getter: dataLoaded

fresh only when `features` were fetched for the current static-block set;
overrides GlobalFetchMixin's default so `svgReady` can resolve on load

```ts
type dataLoaded = boolean
```

**Actions**

#### action: setFeatures

```ts
type setFeatures = (f: Feature[], signature: string) => void
```

#### action: setFeatureDensityStats

Records the span the byte estimate was measured at so `estimatedVisibleBytes`
can scale it to the current view.

```ts
type setFeatureDensityStats = (stats?: FeatureDensityStats | undefined) => void
```

#### action: setFeatureDensityStatsLimit

Force-load raises the byte gate past the estimate scaled to the _current_ view
(shared helper), not the raw captured bytes, so it clears even if the view
zoomed out after the estimate was captured.

```ts
type setFeatureDensityStatsLimit = (
  stats?: { bytes?: number | undefined } | undefined,
) => void
```

</details>

<details>
<summary>Derived from GlobalFetchMixin</summary>

[GlobalFetchMixin →](../globalfetchmixin)

**Volatiles**

#### volatile: reloadCounter

Bumped by `reload()` to retrigger a global display's fetch autorun. Each display
reads `void self.reloadCounter` in its `afterAttach` fetch autorun so a
user-initiated reload re-runs the fetch even when no viewport/setting changed.

```ts
// type signature
type reloadCounter = number
// code
reloadCounter: 0
```

**Getters**

#### getter: svgReadyExtraTerminal

Overridable hook (default false): a subclass returns true to mark an extra
terminal state where off-screen export can proceed with no loaded data (mirrors
`MultiRegionDisplayMixin.svgReadyExtraTerminal`).

```ts
type svgReadyExtraTerminal = boolean
```

#### getter: svgReady

Global-display analog of `MultiRegionDisplayMixin.svgReady`: true once an
off-screen (SVG) export can read final data. Like that mixin it requires the
dataset to actually be loaded (or a terminal error / too-large / extra state),
NOT merely "not currently fetching": the fetch trigger is a debounced
`afterAttach` autorun, so at export time `isLoading` can still be false with no
data yet — a `displayPhase !== 'loading'` test would then capture an empty
render. Never gates on `canvasDrawn`, which an off-screen export never sets.
Off-screen renderers gate on it via `awaitSvgReady(model)`.

```ts
type svgReady = boolean
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

#### action: forceLoad

Raises the byte limit past the current density stats and triggers a reload. The
display chrome calls this via TooLargeMessage's force-load button; concrete
display models override reload() to do the actual refetch.

```ts
type forceLoad = () => void
```

</details>

<details>
<summary>Derived from FetchMixin</summary>

[FetchMixin →](../fetchmixin)

**Volatiles**

#### volatile: activeStopToken

stop token of the in-flight fetch, or undefined when idle

```ts
// type signature
type activeStopToken = StopToken | undefined
// code
activeStopToken: undefined as StopToken | undefined
```

#### volatile: fetchGeneration

bumps at every fetch end; autoruns read it to re-evaluate, and it doubles as the
staleness epoch inside runFetch

```ts
// type signature
type fetchGeneration = number
// code
fetchGeneration: 0
```

#### volatile: fetchCanceled

true after the user explicitly cancels a load (the loading overlay's cancel
button → `cancelFetchByUser`). A durable, blocking state — unlike `cancelFetch`,
it does not retrigger the fetch autoruns — so the load stays stopped until the
user retries (`reload`) or the viewport changes. Any new fetch clears it
(`runFetch` resets it at the start).

```ts
// type signature
type fetchCanceled = false
// code
fetchCanceled: false
```

#### volatile: regionStatuses

latest status of each concurrent in-flight operation, keyed by an arbitrary id
(the canvas display uses displayedRegionIndex). Plain bookkeeping — not read
reactively; setRegionStatus derives the observable statusMessage/statusProgress
from it on every update so N parallel region fetches aggregate into one bar
instead of clobbering.

```ts
// type signature
type regionStatuses = Map<number, RpcStatus>
// code
regionStatuses: new Map<number, RpcStatus>()
```

#### volatile: lastStatusMs

Date.now() of the last applied status write; the status callbacks gate on it to
throttle a high-frequency progress stream.

```ts
// type signature
type lastStatusMs = number
// code
lastStatusMs: 0
```

**Getters**

#### getter: isLoading

true while a fetch is active

```ts
type isLoading = boolean
```

**Methods**

#### method: makeStatusCallback

An RPC `statusCallback` bound to this display: forwards progress to the shared
`statusMessage`, guarded by `isAlive` so a callback that fires after the node is
torn down (RPCs resolve their status stream asynchronously) is a safe no-op.
Pass directly as the `statusCallback` RPC arg instead of re-inlining the guard
at every call site.

```ts
type makeStatusCallback = () => (status: RpcStatus) => void
```

#### method: makeRegionStatusCallback

Per-region variant of `makeStatusCallback`: routes progress through
`setRegionStatus(key, …)` so N concurrent per-region fetches aggregate into one
status bar instead of clobbering each other. Same `isAlive` guard.

```ts
type makeRegionStatusCallback = (key: number) => (status: RpcStatus) => void
```

**Actions**

#### action: throttleStatus

Run `apply` only if at least `STATUS_THROTTLE_MS` has passed since the last
status write. A leading-edge throttle: sparse updates pass straight through,
dense progress bursts are thinned so the loading overlay stops re-rendering
faster than the view animates. The final status doesn't need a trailing flush —
fetch completion clears it via `resetStatus`.

```ts
type throttleStatus = (apply: () => void) => void
```

#### action: resetStatus

Drop the active stop token and clear all status bookkeeping. Shared by both
cancel paths and runFetch's cleanup.

```ts
type resetStatus = () => void
```

#### action: stopActiveFetch

Abort the in-flight fetch (if any) and clear its status. The shared preamble of
both cancel paths; the difference between them is only what they do to
`fetchCanceled` / `fetchGeneration` afterward.

```ts
type stopActiveFetch = () => void
```

#### action: setRegionStatus

Record one concurrent operation's latest status (keyed) and recompute the shared
statusMessage/statusProgress as the aggregate across all in-flight keys. Pass
undefined to drop a key. Used by displays that fan a single fetch out into
parallel per-region RPCs.

```ts
type setRegionStatus = (key: number, status?: RpcStatus | undefined) => void
```

#### action: cancelFetch

cancel any in-flight fetch and bump fetchGeneration (always bumps, so callers
can retrigger fetch autoruns even when nothing was in flight). This is the
_internal_ reset used by clearAllRpcData/invalidateLoadedRegions — it clears any
user-cancel flag so the retrigger actually re-fetches.

```ts
type cancelFetch = () => void
```

#### action: cancelFetchByUser

User-initiated cancel from the loading overlay. Stops the in-flight fetch and
lands in a durable `fetchCanceled` state. Unlike `cancelFetch`, it does NOT bump
fetchGeneration — so the fetch autoruns don't immediately restart the load. The
user retries via `reload` (the overlay's retry button), or it clears on the next
viewport change.

```ts
type cancelFetchByUser = () => void
```

#### action: runFetch

Run a cancel-safe fetch (cancels any prior). The work callback gets a
FetchContext with a stopToken to forward to the RPC and an isStale() check to
short-circuit commits once the user has moved on. Abort errors are swallowed;
others are stored in `error` if not stale.

```ts
type runFetch = (work: (ctx: FetchContext) => Promise<void>) => Promise<void>
```

</details>
