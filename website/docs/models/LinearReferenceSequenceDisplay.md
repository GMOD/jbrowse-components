---
id: linearreferencesequencedisplay
title: LinearReferenceSequenceDisplay
sidebar_label: Display -> LinearReferenceSequenceDisplay
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`sequence` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/LinearReferenceSequenceDisplay/model.ts).

## Example usage

A complete `ReferenceSequenceTrack` config to paste into `tracks` (an assembly's
`sequence` track takes the same shape). `showForward`, `showReverse`, and
`showTranslation` toggle the strand/translation rows:

```js
{
  type: 'ReferenceSequenceTrack',
  trackId: 'refseq',
  name: 'Reference sequence',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'IndexedFastaAdapter',
    uri: 'https://example.com/genome.fa',
  },
  displays: [
    {
      type: 'LinearReferenceSequenceDisplay',
      displayId: 'refseq-LinearReferenceSequenceDisplay',
      showTranslation: false,
    },
  ],
}
```

## Overview

base model `BaseDisplay` + `TrackHeightMixin` + `MultiRegionDisplayMixin`

## Members

| Member                                                             | Kind       | Defined by                                            | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------ | ---------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [type](#property-type)                                             | Properties | LinearReferenceSequenceDisplay                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [configuration](#property-configuration)                           | Properties | LinearReferenceSequenceDisplay                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [sequenceData](#volatile-sequencedata)                             | Volatiles  | LinearReferenceSequenceDisplay                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [showForward](#getter-showforward)                                 | Getters    | LinearReferenceSequenceDisplay                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [showReverse](#getter-showreverse)                                 | Getters    | LinearReferenceSequenceDisplay                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [showTranslation](#getter-showtranslation)                         | Getters    | LinearReferenceSequenceDisplay                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [sequenceType](#getter-sequencetype)                               | Getters    | LinearReferenceSequenceDisplay                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [colorState](#getter-colorstate)                                   | Getters    | LinearReferenceSequenceDisplay                        | Theme-derived palette + text colors, derived from the session theme so they're always available — including headless SVG export and RPC, where no component mounts to seed them.                                                                                                                                                                                                                                                                                                               |
| [isDna](#getter-isdna)                                             | Getters    | LinearReferenceSequenceDisplay                        | true for DNA tracks; reverse-complement and translation rows are gated on this since they are biologically meaningful only for DNA.                                                                                                                                                                                                                                                                                                                                                            |
| [effectiveShowReverse](#getter-effectiveshowreverse)               | Getters    | LinearReferenceSequenceDisplay                        | reverse-complement row is meaningful only for DNA                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [effectiveShowTranslation](#getter-effectiveshowtranslation)       | Getters    | LinearReferenceSequenceDisplay                        | translation rows are meaningful only for DNA                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [zoomedOut](#getter-zoomedout)                                     | Getters    | LinearReferenceSequenceDisplay                        | the view is too zoomed out to show individual bases                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [svgReadyExtraTerminal](#getter-svgreadyextraterminal)             | Getters    | LinearReferenceSequenceDisplay                        | zoomedOut is a terminal renderable state (static "zoom in" message, no fetch), so it makes `svgReady` resolve even though no data loads. See MultiRegionDisplayMixin.svgReadyExtraTerminal.                                                                                                                                                                                                                                                                                                    |
| [numRows](#getter-numrows)                                         | Getters    | LinearReferenceSequenceDisplay                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [sequenceHeight](#getter-sequenceheight)                           | Getters    | LinearReferenceSequenceDisplay                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [computedHeight](#getter-computedheight)                           | Getters    | LinearReferenceSequenceDisplay                        | collapses to 50px when zoomed out (no sequence visible) or before the view initializes; otherwise sized to fit the visible rows.                                                                                                                                                                                                                                                                                                                                                               |
| [height](#getter-height)                                           | Getters    | LinearReferenceSequenceDisplay                        | override TrackHeightMixin height: use manual resize if set, otherwise the zoom-aware computed height.                                                                                                                                                                                                                                                                                                                                                                                          |
| [rowHeight](#getter-rowheight)                                     | Getters    | LinearReferenceSequenceDisplay                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [renderState](#getter-renderstate)                                 | Getters    | LinearReferenceSequenceDisplay                        | everything the Canvas2D backend needs to paint a frame                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [displayPhase](#getter-displayphase)                               | Getters    | LinearReferenceSequenceDisplay                        | Same precedence as MultiRegionDisplayMixin plus a zoom gate: when zoomed past base resolution the body shows a "zoom in" message, so suppress the loading phase (fall through to `ready`) and let that message show. The chrome's loading-overlay visibility derives from this overridden getter.                                                                                                                                                                                              |
| [hoverAt](#method-hoverat)                                         | Methods    | LinearReferenceSequenceDisplay                        | Resolve the genomic position, reference base, and codon/amino-acid under a cursor at track-relative pixel `(offsetX, offsetY)`. Drives the hover tooltip; returns undefined when zoomed out, off a fetched region, or between rows.                                                                                                                                                                                                                                                            |
| [renderSvg](#method-rendersvg)                                     | Methods    | LinearReferenceSequenceDisplay                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [trackMenuItems](#method-trackmenuitems)                           | Methods    | LinearReferenceSequenceDisplay                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [setSequenceRegion](#action-setsequenceregion)                     | Actions    | LinearReferenceSequenceDisplay                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [clearDisplaySpecificData](#action-cleardisplayspecificdata)       | Actions    | LinearReferenceSequenceDisplay                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [toggleShowForward](#action-toggleshowforward)                     | Actions    | LinearReferenceSequenceDisplay                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [toggleShowReverse](#action-toggleshowreverse)                     | Actions    | LinearReferenceSequenceDisplay                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [toggleShowTranslation](#action-toggleshowtranslation)             | Actions    | LinearReferenceSequenceDisplay                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [addGCContentTrack](#action-addgccontenttrack)                     | Actions    | LinearReferenceSequenceDisplay                        | spins up a standalone GCContentTrack session track that wraps this track's sequence adapter (requires the gccontent plugin)                                                                                                                                                                                                                                                                                                                                                                    |
| [startRenderingBackend](#action-startrenderingbackend)             | Actions    | LinearReferenceSequenceDisplay                        | Called by `useRenderingBackend` (via DisplayChrome) once the canvas backend is created. Streams each fetched region into the backend and draws every frame from `renderState`.                                                                                                                                                                                                                                                                                                                 |
| [fetchNeeded](#action-fetchneeded)                                 | Actions    | LinearReferenceSequenceDisplay                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [id](#property-id)                                                 | Properties | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [rpcDriverName](#property-rpcdrivername)                           | Properties | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [error](#volatile-error)                                           | Volatiles  | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [statusMessage](#volatile-statusmessage)                           | Volatiles  | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [statusProgress](#volatile-statusprogress)                         | Volatiles  | [BaseDisplay](../basedisplay)                         | determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate. Set alongside `statusMessage` by `setStatusMessage`; a display that never shows a bar simply leaves it undefined.                                                                                                                                                                                                                                                          |
| [parentTrack](#getter-parenttrack)                                 | Getters    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [parentDisplay](#getter-parentdisplay)                             | Getters    | [BaseDisplay](../basedisplay)                         | Returns the parent display if this display is nested within another display (e.g., PileupDisplay inside LinearAlignmentsDisplay)                                                                                                                                                                                                                                                                                                                                                               |
| [RenderingComponent](#getter-renderingcomponent)                   | Getters    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [DisplayBlurb](#getter-displayblurb)                               | Getters    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [adapterConfig](#getter-adapterconfig)                             | Getters    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [isMinimized](#getter-isminimized)                                 | Getters    | [BaseDisplay](../basedisplay)                         | Returns true if the parent track is minimized. Used to skip expensive operations like autoruns when track is not visible.                                                                                                                                                                                                                                                                                                                                                                      |
| [effectiveRpcDriverName](#getter-effectiverpcdrivername)           | Getters    | [BaseDisplay](../basedisplay)                         | Returns the effective RPC driver name with hierarchical fallback: 1. This display's explicit rpcDriverName 2. Parent display's effectiveRpcDriverName (for nested displays) 3. Track config's rpcDriverName                                                                                                                                                                                                                                                                                    |
| [DisplayMessageComponent](#getter-displaymessagecomponent)         | Getters    | [BaseDisplay](../basedisplay)                         | if a display-level message should be displayed instead, make this return a react component                                                                                                                                                                                                                                                                                                                                                                                                     |
| [renderingProps](#method-renderingprops)                           | Methods    | [BaseDisplay](../basedisplay)                         | props passed to the renderer's React "Rendering" component. these are client-side only and never sent to the worker. includes displayModel and callbacks                                                                                                                                                                                                                                                                                                                                       |
| [regionCannotBeRendered](#method-regioncannotberendered)           | Methods    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [setStatusMessage](#action-setstatusmessage)                       | Actions    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [setError](#action-seterror)                                       | Actions    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [setRpcDriverName](#action-setrpcdrivername)                       | Actions    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [reload](#action-reload)                                           | Actions    | [BaseDisplay](../basedisplay)                         | base display reload does nothing, see specialized displays for details                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [scrollTop](#volatile-scrolltop)                                   | Volatiles  | [TrackHeightMixin](../trackheightmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [setScrollTop](#action-setscrolltop)                               | Actions    | [TrackHeightMixin](../trackheightmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [setHeight](#action-setheight)                                     | Actions    | [TrackHeightMixin](../trackheightmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [resizeHeight](#action-resizeheight)                               | Actions    | [TrackHeightMixin](../trackheightmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [loadedRegions](#volatile-loadedregions)                           | Volatiles  | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | regions whose data has been fetched and committed, keyed by displayedRegionIndex; populated only after the fetch work callback returns                                                                                                                                                                                                                                                                                                                                                         |
| [isReady](#getter-isready)                                         | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | true once the canvas has painted and no fetch is in flight                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [viewportWithinLoadedData](#getter-viewportwithinloadeddata)       | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | true when every visible block lies within an already-fetched region — i.e. the viewport shows data we actually loaded, not the stale fringe left after a zoom-out/pan. Drives the loading overlay through the pre-refetch debounce. Spatial only; see CLAUDE.md for why this is exact and for the resolution-staleness gap.                                                                                                                                                                    |
| [svgReady](#getter-svgready)                                       | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | true once an off-screen (SVG) export can safely read this display's data: every visible region has loaded, or the fetch reached a terminal error / too-large state. Off-screen renderers gate on it via `awaitSvgReady(model)` instead of inlining the condition. Regions stream in one at a time, so gating on `viewportWithinLoadedData` (not the first datum) is what keeps multi-region/whole-genome exports complete; `loadedRegions.size` guards the vacuously-true empty-viewport case. |
| [renderBlocks](#getter-renderblocks)                               | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Shared cached view for every LGV-based GPU display. A single displayedRegion may produce multiple render blocks (shared GPU buffer, different scissor clips on screen). Plugins that want to suppress rendering in certain states (e.g. no domain yet) can override this getter to return [] — the autorun lifecycle will then issue an empty-blocks render that clears the canvas.                                                                                                            |
| [setLoadedRegion](#action-setloadedregion)                         | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Action wrapper so callers after async boundaries stay in MST strict mode.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [clearAllRpcData](#action-clearallrpcdata)                         | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | full reset: cancels fetch, clears error, regionTooLarge, loadedRegions, display-specific data, and the canvas-drawn flag                                                                                                                                                                                                                                                                                                                                                                       |
| [invalidateLoadedRegions](#action-invalidateloadedregions)         | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | lighter reset: cancels fetch and clears loadedRegions, leaving error and regionTooLarge intact                                                                                                                                                                                                                                                                                                                                                                                                 |
| [isCacheValid](#action-iscachevalid)                               | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Overridable hook: return `false` to force re-fetch at the current zoom (wiggle uses this for zoom-level changes).                                                                                                                                                                                                                                                                                                                                                                              |
| [getByteEstimateConfig](#action-getbyteestimateconfig)             | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Overridable hook: return config to enable byte-estimate gating before fetch.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [fetchRegions](#action-fetchregions)                               | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Run a per-region fetch with byte-estimate gating. Marks regions as loaded only AFTER the work callback has populated display-specific data (rpcDataMap, cellData, etc) so the GPU upload autorun sees committed data when it observes loadedRegions.                                                                                                                                                                                                                                           |
| [afterAttach](#action-afterattach)                                 | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | installs the four fetch-lifecycle autoruns (DisplayedRegionsChange, FetchVisibleRegions, SettingsInvalidate, ClearBlockingStateOnViewportChange)                                                                                                                                                                                                                                                                                                                                               |
| [userByteSizeLimit](#property-userbytesizelimit)                   | Properties | [RegionTooLargeMixin](../regiontoolargemixin)         | user-confirmed byte limit after a force-load, disabling the gate                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [regionTooLargeState](#volatile-regiontoolargestate)               | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [regionTooLargeReasonState](#volatile-regiontoolargereasonstate)   | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [featureDensityStats](#volatile-featuredensitystats)               | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [regionTooLarge](#getter-regiontoolarge)                           | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [regionTooLargeReason](#getter-regiontoolargereason)               | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [regionCannotBeRenderedText](#method-regioncannotberenderedtext)   | Methods    | [RegionTooLargeMixin](../regiontoolargemixin)         | Plaintext reason (for SVG export); the on-screen too-large UI is rendered by the display chrome via `TooLargeMessage`, not the model.                                                                                                                                                                                                                                                                                                                                                          |
| [setRegionTooLarge](#action-setregiontoolarge)                     | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [setFeatureDensityStats](#action-setfeaturedensitystats)           | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [setFeatureDensityStatsLimit](#action-setfeaturedensitystatslimit) | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)         | force-load: raise the byte limit past the current request and clear the too-large banner                                                                                                                                                                                                                                                                                                                                                                                                       |
| [forceLoad](#action-forceload)                                     | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)         | Raises the byte limit past the current density stats and triggers a reload. The display chrome calls this via TooLargeMessage's force-load button; concrete display models override reload() to do the actual refetch.                                                                                                                                                                                                                                                                         |
| [canvasDrawn](#volatile-canvasdrawn)                               | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | flips true on first paint; read by test selectors to detect render                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [currentRenderingBackend](#volatile-currentrenderingbackend)       | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | current backend reference, updated on context-loss recovery. Typed `unknown` (not generic `B`) on purpose: this mixin is composed by every display via a non-generic factory, so the per-display backend type `B` isn't known here — it's supplied at `attachRenderingBackend<B>` and narrowed with `as B` inside the autoruns. Don't "fix" the cast.                                                                                                                                          |
| [renderTick](#volatile-rendertick)                                 | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | counter the render autorun observes; bumped to force a re-render                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [autorunsInstalled](#volatile-autorunsinstalled)                   | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | guards attachRenderingBackend so the autorun pair spawns once per instance                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [renderError](#volatile-rendererror)                               | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | the render-backend (GPU/Canvas2D init or context-loss) error, or undefined. Single source of truth for the render-error terminal state: `useRenderingBackend` writes it from the canvas-init mechanism so the model — not React-local hook state — owns every terminal state. Read by `displayPhase` (whose `renderError` term outranks `loading`, suppressing the scrim) and by `DisplayChrome` (shows the retry overlay).                                                                    |
| [markCanvasDrawn](#action-markcanvasdrawn)                         | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [resetCanvasDrawn](#action-resetcanvasdrawn)                       | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [stopRenderingBackend](#action-stoprenderingbackend)               | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [renderNow](#action-rendernow)                                     | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [setRenderError](#action-setrendererror)                           | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       | set/clear the render-backend error. Called by `useRenderingBackend`: with the error when the canvas factory rejects (or context-loss re-init fails), and with `undefined` on successful (re)init and on retry.                                                                                                                                                                                                                                                                                 |
| [attachRenderingBackend](#action-attachrenderingbackend)           | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       | attach a GPU/Canvas2D backend and install the upload + render autorun pair (idempotent — re-calling only swaps the backend)                                                                                                                                                                                                                                                                                                                                                                    |
| [activeStopToken](#volatile-activestoptoken)                       | Volatiles  | [FetchMixin](../fetchmixin)                           | stop token of the in-flight fetch, or undefined when idle                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [fetchGeneration](#volatile-fetchgeneration)                       | Volatiles  | [FetchMixin](../fetchmixin)                           | bumps at every fetch end; autoruns read it to re-evaluate, and it doubles as the staleness epoch inside runFetch                                                                                                                                                                                                                                                                                                                                                                               |
| [fetchCanceled](#volatile-fetchcanceled)                           | Volatiles  | [FetchMixin](../fetchmixin)                           | true after the user explicitly cancels a load (the loading overlay's cancel button → `cancelFetchByUser`). A durable, blocking state — unlike `cancelFetch`, it does not retrigger the fetch autoruns — so the load stays stopped until the user retries (`reload`) or the viewport changes. Any new fetch clears it (`runFetch` resets it at the start).                                                                                                                                      |
| [regionStatuses](#volatile-regionstatuses)                         | Volatiles  | [FetchMixin](../fetchmixin)                           | latest status of each concurrent in-flight operation, keyed by an arbitrary id (the canvas display uses displayedRegionIndex). Plain bookkeeping — not read reactively; setRegionStatus derives the observable statusMessage/statusProgress from it on every update so N parallel region fetches aggregate into one bar instead of clobbering.                                                                                                                                                 |
| [lastStatusMs](#volatile-laststatusms)                             | Volatiles  | [FetchMixin](../fetchmixin)                           | Date.now() of the last applied status write; the status callbacks gate on it to throttle a high-frequency progress stream.                                                                                                                                                                                                                                                                                                                                                                     |
| [isLoading](#getter-isloading)                                     | Getters    | [FetchMixin](../fetchmixin)                           | true while a fetch is active                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [makeStatusCallback](#method-makestatuscallback)                   | Methods    | [FetchMixin](../fetchmixin)                           | An RPC `statusCallback` bound to this display: forwards progress to the shared `statusMessage`, guarded by `isAlive` so a callback that fires after the node is torn down (RPCs resolve their status stream asynchronously) is a safe no-op. Pass directly as the `statusCallback` RPC arg instead of re-inlining the guard at every call site.                                                                                                                                                |
| [makeRegionStatusCallback](#method-makeregionstatuscallback)       | Methods    | [FetchMixin](../fetchmixin)                           | Per-region variant of `makeStatusCallback`: routes progress through `setRegionStatus(key, …)` so N concurrent per-region fetches aggregate into one status bar instead of clobbering each other. Same `isAlive` guard.                                                                                                                                                                                                                                                                         |
| [throttleStatus](#action-throttlestatus)                           | Actions    | [FetchMixin](../fetchmixin)                           | Run `apply` only if at least `STATUS_THROTTLE_MS` has passed since the last status write. A leading-edge throttle: sparse updates pass straight through, dense progress bursts are thinned so the loading overlay stops re-rendering faster than the view animates. The final status doesn't need a trailing flush — fetch completion clears it via `resetStatus`.                                                                                                                             |
| [resetStatus](#action-resetstatus)                                 | Actions    | [FetchMixin](../fetchmixin)                           | Drop the active stop token and clear all status bookkeeping. Shared by both cancel paths and runFetch's cleanup.                                                                                                                                                                                                                                                                                                                                                                               |
| [stopActiveFetch](#action-stopactivefetch)                         | Actions    | [FetchMixin](../fetchmixin)                           | Abort the in-flight fetch (if any) and clear its status. The shared preamble of both cancel paths; the difference between them is only what they do to `fetchCanceled` / `fetchGeneration` afterward.                                                                                                                                                                                                                                                                                          |
| [setRegionStatus](#action-setregionstatus)                         | Actions    | [FetchMixin](../fetchmixin)                           | Record one concurrent operation's latest status (keyed) and recompute the shared statusMessage/statusProgress as the aggregate across all in-flight keys. Pass undefined to drop a key. Used by displays that fan a single fetch out into parallel per-region RPCs.                                                                                                                                                                                                                            |
| [cancelFetch](#action-cancelfetch)                                 | Actions    | [FetchMixin](../fetchmixin)                           | cancel any in-flight fetch and bump fetchGeneration (always bumps, so callers can retrigger fetch autoruns even when nothing was in flight). This is the _internal_ reset used by clearAllRpcData/invalidateLoadedRegions — it clears any user-cancel flag so the retrigger actually re-fetches.                                                                                                                                                                                               |
| [cancelFetchByUser](#action-cancelfetchbyuser)                     | Actions    | [FetchMixin](../fetchmixin)                           | User-initiated cancel from the loading overlay. Stops the in-flight fetch and lands in a durable `fetchCanceled` state. Unlike `cancelFetch`, it does NOT bump fetchGeneration — so the fetch autoruns don't immediately restart the load. The user retries via `reload` (the overlay's retry button), or it clears on the next viewport change.                                                                                                                                               |
| [runFetch](#action-runfetch)                                       | Actions    | [FetchMixin](../fetchmixin)                           | Run a cancel-safe fetch (cancels any prior). The work callback gets a FetchContext with a stopToken to forward to the RPC and an isStale() check to short-circuit commits once the user has moved on. Abort errors are swallowed; others are stored in `error` if not stale.                                                                                                                                                                                                                   |

### LinearReferenceSequenceDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/linearreferencesequencedisplay).

<details>
<summary>LinearReferenceSequenceDisplay - Properties</summary>

#### property: type

```ts
// type signature
type type = ISimpleType<'LinearReferenceSequenceDisplay'>
// code
type: types.literal('LinearReferenceSequenceDisplay')
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
<summary>LinearReferenceSequenceDisplay - Volatiles</summary>

#### volatile: sequenceData

```ts
// type signature
type sequenceData = ObservableMap<number, SequenceRegionData>
// code
sequenceData: observable.map<number, SequenceRegionData>()
```

</details>

<details>
<summary>LinearReferenceSequenceDisplay - Getters</summary>

#### getter: colorState

Theme-derived palette + text colors, derived from the session theme so they're
always available — including headless SVG export and RPC, where no component
mounts to seed them.

```ts
type colorState = { palette: ColorPalette; textColors: TextColors }
```

#### getter: isDna

true for DNA tracks; reverse-complement and translation rows are gated on this
since they are biologically meaningful only for DNA.

```ts
type isDna = boolean
```

#### getter: effectiveShowReverse

reverse-complement row is meaningful only for DNA

```ts
type effectiveShowReverse = boolean
```

#### getter: effectiveShowTranslation

translation rows are meaningful only for DNA

```ts
type effectiveShowTranslation = boolean
```

#### getter: zoomedOut

the view is too zoomed out to show individual bases

```ts
type zoomedOut = boolean
```

#### getter: svgReadyExtraTerminal

zoomedOut is a terminal renderable state (static "zoom in" message, no fetch),
so it makes `svgReady` resolve even though no data loads. See
MultiRegionDisplayMixin.svgReadyExtraTerminal.

```ts
type svgReadyExtraTerminal = boolean
```

#### getter: computedHeight

collapses to 50px when zoomed out (no sequence visible) or before the view
initializes; otherwise sized to fit the visible rows.

```ts
type computedHeight = number
```

#### getter: height

override TrackHeightMixin height: use manual resize if set, otherwise the
zoom-aware computed height.

```ts
type height = number
```

#### getter: renderState

everything the Canvas2D backend needs to paint a frame

```ts
type renderState = DrawSequenceState
```

#### getter: displayPhase

Same precedence as MultiRegionDisplayMixin plus a zoom gate: when zoomed past
base resolution the body shows a "zoom in" message, so suppress the loading
phase (fall through to `ready`) and let that message show. The chrome's
loading-overlay visibility derives from this overridden getter.

```ts
type displayPhase = DisplayPhase
```

</details>

<details>
<summary>LinearReferenceSequenceDisplay - Getters (other undocumented members)</summary>

#### getter: showForward

```ts
type showForward = boolean
```

#### getter: showReverse

```ts
type showReverse = boolean
```

#### getter: showTranslation

```ts
type showTranslation = boolean
```

#### getter: sequenceType

```ts
type sequenceType = any
```

#### getter: numRows

```ts
type numRows = number
```

#### getter: sequenceHeight

```ts
type sequenceHeight = number
```

#### getter: rowHeight

```ts
type rowHeight = number
```

</details>

<details>
<summary>LinearReferenceSequenceDisplay - Methods</summary>

#### method: hoverAt

Resolve the genomic position, reference base, and codon/amino-acid under a
cursor at track-relative pixel `(offsetX, offsetY)`. Drives the hover tooltip;
returns undefined when zoomed out, off a fetched region, or between rows.

```ts
type hoverAt = (offsetX: number, offsetY: number) => SequenceHover | undefined
```

</details>

<details>
<summary>LinearReferenceSequenceDisplay - Methods (other undocumented members)</summary>

#### method: renderSvg

```ts
type renderSvg = (
  opts?: ExportSvgDisplayOptions | undefined,
) => Promise<Element>
```

#### method: trackMenuItems

```ts
type trackMenuItems = () => (
  | { label: string; type: string; checked: boolean; onClick: () => void }
  | {
      label: string
      onClick: () => void
      type?: undefined
      checked?: undefined
    }
)[]
```

</details>

<details>
<summary>LinearReferenceSequenceDisplay - Actions</summary>

#### action: addGCContentTrack

spins up a standalone GCContentTrack session track that wraps this track's
sequence adapter (requires the gccontent plugin)

```ts
type addGCContentTrack = () => void
```

#### action: startRenderingBackend

Called by `useRenderingBackend` (via DisplayChrome) once the canvas backend is
created. Streams each fetched region into the backend and draws every frame from
`renderState`.

```ts
type startRenderingBackend = (backend: Canvas2DSequenceRenderer) => void
```

</details>

<details>
<summary>LinearReferenceSequenceDisplay - Actions (other undocumented members)</summary>

#### action: setSequenceRegion

```ts
type setSequenceRegion = (idx: number, data: SequenceRegionData) => void
```

#### action: clearDisplaySpecificData

```ts
type clearDisplaySpecificData = () => void
```

#### action: toggleShowForward

```ts
type toggleShowForward = () => void
```

#### action: toggleShowReverse

```ts
type toggleShowReverse = () => void
```

#### action: toggleShowTranslation

```ts
type toggleShowTranslation = () => void
```

#### action: fetchNeeded

```ts
type fetchNeeded = (
  needed: { region: Region; displayedRegionIndex: number }[],
) => Promise<void>
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
<summary>Derived from MultiRegionDisplayMixin</summary>

[MultiRegionDisplayMixin →](../multiregiondisplaymixin)

**Volatiles**

#### volatile: loadedRegions

regions whose data has been fetched and committed, keyed by
displayedRegionIndex; populated only after the fetch work callback returns

```ts
// type signature
type loadedRegions = ObservableMap<number, Region>
// code
loadedRegions: observable.map<number, Region>()
```

**Getters**

#### getter: isReady

true once the canvas has painted and no fetch is in flight

```ts
type isReady = boolean
```

#### getter: viewportWithinLoadedData

true when every visible block lies within an already-fetched region — i.e. the
viewport shows data we actually loaded, not the stale fringe left after a
zoom-out/pan. Drives the loading overlay through the pre-refetch debounce.
Spatial only; see CLAUDE.md for why this is exact and for the
resolution-staleness gap.

```ts
type viewportWithinLoadedData = boolean
```

#### getter: svgReady

true once an off-screen (SVG) export can safely read this display's data: every
visible region has loaded, or the fetch reached a terminal error / too-large
state. Off-screen renderers gate on it via `awaitSvgReady(model)` instead of
inlining the condition. Regions stream in one at a time, so gating on
`viewportWithinLoadedData` (not the first datum) is what keeps
multi-region/whole-genome exports complete; `loadedRegions.size` guards the
vacuously-true empty-viewport case.

```ts
type svgReady = boolean
```

#### getter: renderBlocks

Shared cached view for every LGV-based GPU display. A single displayedRegion may
produce multiple render blocks (shared GPU buffer, different scissor clips on
screen). Plugins that want to suppress rendering in certain states (e.g. no
domain yet) can override this getter to return [] — the autorun lifecycle will
then issue an empty-blocks render that clears the canvas.

```ts
type renderBlocks = RenderBlock[]
```

**Actions**

#### action: setLoadedRegion

Action wrapper so callers after async boundaries stay in MST strict mode.

```ts
type setLoadedRegion = (displayedRegionIndex: number, region: Region) => void
```

#### action: clearAllRpcData

full reset: cancels fetch, clears error, regionTooLarge, loadedRegions,
display-specific data, and the canvas-drawn flag

```ts
type clearAllRpcData = () => void
```

#### action: invalidateLoadedRegions

lighter reset: cancels fetch and clears loadedRegions, leaving error and
regionTooLarge intact

```ts
type invalidateLoadedRegions = () => void
```

#### action: isCacheValid

Overridable hook: return `false` to force re-fetch at the current zoom (wiggle
uses this for zoom-level changes).

```ts
type isCacheValid = (_displayedRegionIndex: number) => boolean
```

#### action: getByteEstimateConfig

Overridable hook: return config to enable byte-estimate gating before fetch.

```ts
type getByteEstimateConfig = () => ByteEstimateConfig | null
```

#### action: fetchRegions

Run a per-region fetch with byte-estimate gating. Marks regions as loaded only
AFTER the work callback has populated display-specific data (rpcDataMap,
cellData, etc) so the GPU upload autorun sees committed data when it observes
loadedRegions.

```ts
type fetchRegions = (
  needed: { region: Region; displayedRegionIndex: number }[],
  work: (ctx: FetchContext) => Promise<void>,
) => Promise<void>
```

#### action: afterAttach

installs the four fetch-lifecycle autoruns (DisplayedRegionsChange,
FetchVisibleRegions, SettingsInvalidate, ClearBlockingStateOnViewportChange)

```ts
type afterAttach = () => void
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

<details>
<summary>Derived from RenderLifecycleMixin</summary>

[RenderLifecycleMixin →](../renderlifecyclemixin)

**Volatiles**

#### volatile: canvasDrawn

flips true on first paint; read by test selectors to detect render

```ts
// type signature
type canvasDrawn = false
// code
canvasDrawn: false
```

#### volatile: currentRenderingBackend

current backend reference, updated on context-loss recovery. Typed `unknown`
(not generic `B`) on purpose: this mixin is composed by every display via a
non-generic factory, so the per-display backend type `B` isn't known here — it's
supplied at `attachRenderingBackend<B>` and narrowed with `as B` inside the
autoruns. Don't "fix" the cast.

```ts
// type signature
type currentRenderingBackend = undefined
// code
currentRenderingBackend: undefined
```

#### volatile: renderTick

counter the render autorun observes; bumped to force a re-render

```ts
// type signature
type renderTick = number
// code
renderTick: 0
```

#### volatile: autorunsInstalled

guards attachRenderingBackend so the autorun pair spawns once per instance

```ts
// type signature
type autorunsInstalled = false
// code
autorunsInstalled: false
```

#### volatile: renderError

the render-backend (GPU/Canvas2D init or context-loss) error, or undefined.
Single source of truth for the render-error terminal state:
`useRenderingBackend` writes it from the canvas-init mechanism so the model —
not React-local hook state — owns every terminal state. Read by `displayPhase`
(whose `renderError` term outranks `loading`, suppressing the scrim) and by
`DisplayChrome` (shows the retry overlay).

```ts
// type signature
type renderError = undefined
// code
renderError: undefined
```

**Actions**

#### action: markCanvasDrawn

```ts
type markCanvasDrawn = () => void
```

#### action: resetCanvasDrawn

```ts
type resetCanvasDrawn = () => void
```

#### action: stopRenderingBackend

```ts
type stopRenderingBackend = () => void
```

#### action: renderNow

```ts
type renderNow = () => void
```

#### action: setRenderError

set/clear the render-backend error. Called by `useRenderingBackend`: with the
error when the canvas factory rejects (or context-loss re-init fails), and with
`undefined` on successful (re)init and on retry.

```ts
type setRenderError = (error: unknown) => void
```

#### action: attachRenderingBackend

attach a GPU/Canvas2D backend and install the upload + render autorun pair
(idempotent — re-calling only swaps the backend)

```ts
type attachRenderingBackend = <B>(
  backend: B,
  cbs: RenderingBackendCallbacks<B>,
) => void
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
