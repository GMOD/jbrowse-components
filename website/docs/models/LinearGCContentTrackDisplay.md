---
id: lineargccontenttrackdisplay
title: LinearGCContentTrackDisplay
sidebar_label: Display -> LinearGCContentTrackDisplay
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`gccontent` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gccontent/src/LinearGCContentDisplay/stateModelTrack.ts).

## Example usage

A standalone `GCContentTrack` whose `GCContentAdapter` wraps a sequence adapter
(use this instead of the `ReferenceSequenceTrack` display when you want GC as
its own track):

```js
{
  type: 'GCContentTrack',
  trackId: 'gc',
  name: 'GC content',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'GCContentAdapter',
    sequenceAdapter: {
      type: 'IndexedFastaAdapter',
      fastaLocation: { uri: 'https://example.com/genome.fa' },
      faiLocation: { uri: 'https://example.com/genome.fa.fai' },
    },
  },
  displays: [
    {
      type: 'LinearGCContentTrackDisplay',
      displayId: 'gc-LinearGCContentTrackDisplay',
      gcMode: 'skew',
    },
  ],
}
```

## Overview

used on GCContentTrack, separately from the display type on the
ReferenceSequenceTrack

## Members

| Member                                                               | Kind       | Defined by                                            | Description                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------- | ---------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [type](#property-type)                                               | Properties | LinearGCContentTrackDisplay                           |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [adapterConfig](#getter-adapterconfig)                               | Getters    | LinearGCContentTrackDisplay                           | applies the current display parameter overrides to the parent GCContentTrack's adapter.                                                                                                                                                                                                                                                                                                                 |
| [windowSize](#getter-windowsize)                                     | Getters    | [SharedGCContentModel](../sharedgccontentmodel)       |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [windowDelta](#getter-windowdelta)                                   | Getters    | [SharedGCContentModel](../sharedgccontentmodel)       |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [gcMode](#getter-gcmode)                                             | Getters    | [SharedGCContentModel](../sharedgccontentmodel)       |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [trackMenuItems](#method-trackmenuitems)                             | Methods    | [SharedGCContentModel](../sharedgccontentmodel)       |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setGCContentParams](#action-setgccontentparams)                     | Actions    | [SharedGCContentModel](../sharedgccontentmodel)       |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setGCMode](#action-setgcmode)                                       | Actions    | [SharedGCContentModel](../sharedgccontentmodel)       |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [configuration](#property-configuration)                             | Properties | [LinearWiggleDisplay](../linearwiggledisplay)         |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [DisplayMessageComponent](#getter-displaymessagecomponent)           | Getters    | [LinearWiggleDisplay](../linearwiggledisplay)         |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [color](#getter-color)                                               | Getters    | [LinearWiggleDisplay](../linearwiggledisplay)         |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [useBicolor](#getter-usebicolor)                                     | Getters    | [LinearWiggleDisplay](../linearwiggledisplay)         |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [isDensityMode](#getter-isdensitymode)                               | Getters    | [LinearWiggleDisplay](../linearwiggledisplay)         |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [ticks](#getter-ticks)                                               | Getters    | [LinearWiggleDisplay](../linearwiggledisplay)         |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [prefersOffset](#getter-prefersoffset)                               | Getters    | [LinearWiggleDisplay](../linearwiggledisplay)         | Offset the track label above the plot so the left y-axis stays pinned to the content edge instead of dodging right of the label.                                                                                                                                                                                                                                                                        |
| [scoreRamp](#getter-scoreramp)                                       | Getters    | [LinearWiggleDisplay](../linearwiggledisplay)         | The color ramp the density legend draws, or undefined when there is no single ramp to describe.                                                                                                                                                                                                                                                                                                         |
| [renderState](#getter-renderstate)                                   | Getters    | [LinearWiggleDisplay](../linearwiggledisplay)         |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [rpcProps](#method-rpcprops)                                         | Methods    | [LinearWiggleDisplay](../linearwiggledisplay)         |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [gpuProps](#method-gpuprops)                                         | Methods    | [LinearWiggleDisplay](../linearwiggledisplay)         | single-source gpuProps mapped onto the multi-source build path: - bicolor: no source color override; build emits pos+neg with their respective colors - solid: worker put all features in pos arrays (useBicolor=false); non-density modes use the user's color; density uses posColor (multi default, so leave source.color undefined) Solid mode overrides `negColor` too, not just the source color. |
| [setRpcData](#action-setrpcdata)                                     | Actions    | [LinearWiggleDisplay](../linearwiggledisplay)         |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setUseBicolor](#action-setusebicolor)                               | Actions    | [LinearWiggleDisplay](../linearwiggledisplay)         |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setColor](#action-setcolor)                                         | Actions    | [LinearWiggleDisplay](../linearwiggledisplay)         |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [fetchNeeded](#action-fetchneeded)                                   | Actions    | [LinearWiggleDisplay](../linearwiggledisplay)         |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [renderSvg](#action-rendersvg)                                       | Actions    | [LinearWiggleDisplay](../linearwiggledisplay)         |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [startRenderingBackend](#action-startrenderingbackend)               | Actions    | [LinearWiggleDisplay](../linearwiggledisplay)         |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [id](#property-id)                                                   | Properties | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [rpcDriverName](#property-rpcdrivername)                             | Properties | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [ignorePromotedDefaults](#property-ignorepromoteddefaults)           | Properties | [BaseDisplay](../basedisplay)                         | true for a display that arrived inside a session received from someone else (a share link, an encoded/json session, a `spec-` URL).                                                                                                                                                                                                                                                                     |
| [error](#volatile-error)                                             | Volatiles  | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [statusMessage](#volatile-statusmessage)                             | Volatiles  | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [statusProgress](#volatile-statusprogress)                           | Volatiles  | [BaseDisplay](../basedisplay)                         | determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate.                                                                                                                                                                                                                                                                                     |
| [parentTrack](#getter-parenttrack)                                   | Getters    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [parentDisplay](#getter-parentdisplay)                               | Getters    | [BaseDisplay](../basedisplay)                         | Returns the parent display if this display is nested within another display (e.g., PileupDisplay inside LinearAlignmentsDisplay)                                                                                                                                                                                                                                                                        |
| [RenderingComponent](#getter-renderingcomponent)                     | Getters    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [DisplayBlurb](#getter-displayblurb)                                 | Getters    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [isMinimized](#getter-isminimized)                                   | Getters    | [BaseDisplay](../basedisplay)                         | Returns true if the parent track is minimized.                                                                                                                                                                                                                                                                                                                                                          |
| [effectiveRpcDriverName](#getter-effectiverpcdrivername)             | Getters    | [BaseDisplay](../basedisplay)                         | Returns the effective RPC driver name with hierarchical fallback: 1.                                                                                                                                                                                                                                                                                                                                    |
| [renderingProps](#method-renderingprops)                             | Methods    | [BaseDisplay](../basedisplay)                         | props passed to the renderer's React "Rendering" component.                                                                                                                                                                                                                                                                                                                                             |
| [setIgnorePromotedDefaults](#action-setignorepromoteddefaults)       | Actions    | [BaseDisplay](../basedisplay)                         | see the `ignorePromotedDefaults` property                                                                                                                                                                                                                                                                                                                                                               |
| [setStatusMessage](#action-setstatusmessage)                         | Actions    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setError](#action-seterror)                                         | Actions    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setRpcDriverName](#action-setrpcdrivername)                         | Actions    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [reload](#action-reload)                                             | Actions    | [BaseDisplay](../basedisplay)                         | base display reload does nothing, see specialized displays for details                                                                                                                                                                                                                                                                                                                                  |
| [scrollTop](#volatile-scrolltop)                                     | Volatiles  | [TrackHeightMixin](../trackheightmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [height](#getter-height)                                             | Getters    | [TrackHeightMixin](../trackheightmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setScrollTop](#action-setscrolltop)                                 | Actions    | [TrackHeightMixin](../trackheightmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setHeight](#action-setheight)                                       | Actions    | [TrackHeightMixin](../trackheightmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [resizeHeight](#action-resizeheight)                                 | Actions    | [TrackHeightMixin](../trackheightmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [loadedRegions](#volatile-loadedregions)                             | Volatiles  | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | regions whose data has been fetched and committed, keyed by displayedRegionIndex; populated only after the fetch work callback returns                                                                                                                                                                                                                                                                  |
| [canRender](#getter-canrender)                                       | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | The render-lifecycle precondition for every LGV display (overrides `RenderLifecycleMixin`'s default-true hook): don't run the upload/render callbacks until the view is measured.                                                                                                                                                                                                                       |
| [isReady](#getter-isready)                                           | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | true once the canvas has painted and no fetch is in flight                                                                                                                                                                                                                                                                                                                                              |
| [viewportWithinLoadedData](#getter-viewportwithinloadeddata)         | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | true when every visible block lies within an already-fetched region — i.e. the viewport shows data we actually loaded, not the stale fringe left after a zoom-out/pan.                                                                                                                                                                                                                                  |
| [dataCurrent](#getter-datacurrent)                                   | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | This family's answer to the shared freshness question every display foundation must answer (`dataCurrent`): the held data corresponds to what is on screen right now.                                                                                                                                                                                                                                   |
| [svgReady](#getter-svgready)                                         | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | true once an off-screen (SVG) export can safely read this display's data.                                                                                                                                                                                                                                                                                                                               |
| [svgReadyExtraTerminal](#getter-svgreadyextraterminal)               | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Overridable hook (default false): a subclass returns true to mark an extra terminal state where off-screen export can proceed with no loaded data.                                                                                                                                                                                                                                                      |
| [layoutReady](#getter-layoutready)                                   | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Overridable hook (default false): whether a searchable feature layout currently exists.                                                                                                                                                                                                                                                                                                                 |
| [renderBlocks](#getter-renderblocks)                                 | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Shared cached view for every LGV-based GPU display.                                                                                                                                                                                                                                                                                                                                                     |
| [displayPhase](#getter-displayphase)                                 | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | The display's mutually-exclusive visual state, precedence single-sourced in `computeDisplayPhase`.                                                                                                                                                                                                                                                                                                      |
| [rpcPropsCacheKey](#getter-rpcpropscachekey)                         | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | The RPC cache key watched by `SettingsInvalidate` — the subclass's `rpcProps()` payload serialized to a string.                                                                                                                                                                                                                                                                                         |
| [isCacheValid](#method-iscachevalid)                                 | Methods    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Overridable hook: return `false` to force re-fetch at the current zoom (wiggle uses this for zoom-level changes).                                                                                                                                                                                                                                                                                       |
| [setLoadedRegion](#action-setloadedregion)                           | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Action wrapper so callers after async boundaries stay in MST strict mode.                                                                                                                                                                                                                                                                                                                               |
| [clearDisplaySpecificData](#action-cleardisplayspecificdata)         | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | no-op base — subclasses override to clear rpcDataMap etc.                                                                                                                                                                                                                                                                                                                                               |
| [clearAllRpcData](#action-clearallrpcdata)                           | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | full reset: cancels fetch, clears error, loadedRegions, display-specific data, and the canvas-drawn flag.                                                                                                                                                                                                                                                                                               |
| [invalidateLoadedRegions](#action-invalidateloadedregions)           | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | lighter reset: cancels fetch and clears loadedRegions, leaving error and regionTooLarge intact                                                                                                                                                                                                                                                                                                          |
| [onRegionTooLarge](#action-onregiontoolarge)                         | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Overridable hook (no-op base): called when `regionTooLarge` transitions to true.                                                                                                                                                                                                                                                                                                                        |
| [fetchRegions](#action-fetchregions)                                 | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Run a per-region fetch with byte-estimate gating.                                                                                                                                                                                                                                                                                                                                                       |
| [afterAttach](#action-afterattach)                                   | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | installs the five fetch-lifecycle autoruns (DisplayedRegionsChange, FetchVisibleRegions, SettingsInvalidate, ClearBlockingStateOnViewportChange, ClearHoverOnRegionTooLarge)                                                                                                                                                                                                                            |
| [forceLoadTrack](#volatile-forceloadtrack)                           | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)         | The force-load button's answer: render this track regardless of region size or feature density.                                                                                                                                                                                                                                                                                                         |
| [byteEstimate](#volatile-byteestimate)                               | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)         | The last byte measurement for this display: the estimated bytes **and the span they cover**, which is what lets the derived gate rescale them to the span on screen now.                                                                                                                                                                                                                                |
| [gateFoldedIntoFetch](#getter-gatefoldedintofetch)                   | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | Additive opt-in for displays that measure the estimate inside their own feature RPC instead of a pre-flight (canvas).                                                                                                                                                                                                                                                                                   |
| [byteGateEnabled](#getter-bytegateenabled)                           | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | The one opt-in a pre-flight display writes: true means "measure this fetch and gate on it".                                                                                                                                                                                                                                                                                                             |
| [configuredFetchSizeLimit](#getter-configuredfetchsizelimit)         | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | The composing display's configured `fetchSizeLimit`, read straight from its config.                                                                                                                                                                                                                                                                                                                     |
| [densityTooLarge](#getter-densitytoolarge)                           | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | Second (non-byte) too-large axis folded into the derived verdict — canvas overrides it with its feature-density gate.                                                                                                                                                                                                                                                                                   |
| [adapterFetchSizeLimit](#getter-adapterfetchsizelimit)               | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | The adapter's own `fetchSizeLimit` slot (undefined when the adapter type declares none); `resolveByteLimit` prefers it over the display config.                                                                                                                                                                                                                                                         |
| [configForceLoad](#getter-configforceload)                           | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | Declarative force-load: when true the display always renders regardless of region size / feature density (the config-driven equivalent of the force-load button).                                                                                                                                                                                                                                       |
| [gateVisibleBp](#getter-gatevisiblebp)                               | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | The span on screen, or undefined before the view is measured.                                                                                                                                                                                                                                                                                                                                           |
| [derivedRegionTooLargeEnabled](#getter-derivedregiontoolargeenabled) | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | Whether the derived, self-releasing gate is live at all — the union of the two ways a display can measure: a pre-flight estimate (`byteGateEnabled`) or a byte check folded into its own feature RPC (`gateFoldedIntoFetch`).                                                                                                                                                                           |
| [byteGateExempt](#getter-bytegateexempt)                             | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | True when nothing may gate, on either axis and in both the worker and the banner: the declarative `forceLoad` slot, or the force-load button.                                                                                                                                                                                                                                                           |
| [estimatedBytesForVisibleSpan](#getter-estimatedbytesforvisiblespan) | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | How many bytes we estimate a fetch of the span on screen right now would pull, obtained by rescaling the stored measurement from the span it covers.                                                                                                                                                                                                                                                    |
| [gateByteLimit](#getter-gatebytelimit)                               | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | The byte budget the gate enforces: the adapter's limit, else the display config.                                                                                                                                                                                                                                                                                                                        |
| [gateActive](#getter-gateactive)                                     | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | Whether anything may gate at this moment: the display opted in, nothing exempts it, and the view is measured and wider than the `AUTO_FORCE_LOAD_BP` force-load floor.                                                                                                                                                                                                                                  |
| [tooLargeStatus](#getter-toolargestatus)                             | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | The verdict the whole mixin exists to produce, with the banner text: true when the estimated download for the span on screen exceeds the resolved byte budget, or when the display's own density axis trips (bytes take precedence for the text).                                                                                                                                                       |
| [regionTooLarge](#getter-regiontoolarge)                             | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [regionTooLargeReason](#getter-regiontoolargereason)                 | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | Which axis tripped, as banner text: the estimated download size, or "Too many features".                                                                                                                                                                                                                                                                                                                |
| [resolvedByteLimit](#method-resolvedbytelimit)                       | Methods    | [RegionTooLargeMixin](../regiontoolargemixin)         | The byte budget a fetch RPC enforces worker-side, short-circuiting an over-budget region before it downloads any features.                                                                                                                                                                                                                                                                              |
| [setByteEstimate](#action-setbyteestimate)                           | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)         | Commits a byte measurement: the estimate together with the span it covers, so the derived gate can rescale it to the span on screen.                                                                                                                                                                                                                                                                    |
| [clearByteEstimate](#action-clearbyteestimate)                       | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)         | Drops the cached estimate.                                                                                                                                                                                                                                                                                                                                                                              |
| [setForceLoadTrack](#action-setforceloadtrack)                       | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)         | Exempt this track from the gate (or put it back under it).                                                                                                                                                                                                                                                                                                                                              |
| [forceLoad](#action-forceload)                                       | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)         | Force-load: exempt this track from the gate and refetch.                                                                                                                                                                                                                                                                                                                                                |
| [byteGateBlocksFetch](#action-bytegateblocksfetch)                   | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)         | The entire pre-flight gate for one fetch: measure the region set, commit the estimate with the span it covers, and answer whether the caller must abandon the fetch — either superseded mid-measure, or over budget.                                                                                                                                                                                    |
| [canvasDrawn](#volatile-canvasdrawn)                                 | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | flips true on first paint; read by test selectors to detect render                                                                                                                                                                                                                                                                                                                                      |
| [currentRenderingBackend](#volatile-currentrenderingbackend)         | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | current backend reference, updated on context-loss recovery.                                                                                                                                                                                                                                                                                                                                            |
| [renderTick](#volatile-rendertick)                                   | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | counter the render autorun observes; bumped to force a re-render                                                                                                                                                                                                                                                                                                                                        |
| [autorunsInstalled](#volatile-autorunsinstalled)                     | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | guards attachRenderingBackend so the autorun pair spawns once per instance                                                                                                                                                                                                                                                                                                                              |
| [renderError](#volatile-rendererror)                                 | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | the render-backend (GPU/Canvas2D init or context-loss) error, or undefined.                                                                                                                                                                                                                                                                                                                             |
| [markCanvasDrawn](#action-markcanvasdrawn)                           | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [resetCanvasDrawn](#action-resetcanvasdrawn)                         | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [stopRenderingBackend](#action-stoprenderingbackend)                 | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [renderNow](#action-rendernow)                                       | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setRenderError](#action-setrendererror)                             | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       | set/clear the render-backend error.                                                                                                                                                                                                                                                                                                                                                                     |
| [attachRenderingBackend](#action-attachrenderingbackend)             | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       | attach a GPU/Canvas2D backend and install the upload + render autorun pair (idempotent — re-calling only swaps the backend)                                                                                                                                                                                                                                                                             |
| [activeStopToken](#volatile-activestoptoken)                         | Volatiles  | [FetchMixin](../fetchmixin)                           | stop token of the in-flight fetch, or undefined when idle                                                                                                                                                                                                                                                                                                                                               |
| [fetchGeneration](#volatile-fetchgeneration)                         | Volatiles  | [FetchMixin](../fetchmixin)                           | bumps at every fetch end; autoruns read it to re-evaluate, and it doubles as the staleness epoch inside runFetch                                                                                                                                                                                                                                                                                        |
| [fetchCanceled](#volatile-fetchcanceled)                             | Volatiles  | [FetchMixin](../fetchmixin)                           | true after the user explicitly cancels a load (the loading overlay's cancel button → `cancelFetchByUser`).                                                                                                                                                                                                                                                                                              |
| [regionStatuses](#volatile-regionstatuses)                           | Volatiles  | [FetchMixin](../fetchmixin)                           | latest status of each concurrent in-flight operation, keyed by an arbitrary id (the canvas display uses displayedRegionIndex).                                                                                                                                                                                                                                                                          |
| [isLoading](#getter-isloading)                                       | Getters    | [FetchMixin](../fetchmixin)                           | true while a fetch is active                                                                                                                                                                                                                                                                                                                                                                            |
| [makeStatusCallback](#method-makestatuscallback)                     | Methods    | [FetchMixin](../fetchmixin)                           | An RPC `statusCallback` bound to this display: forwards progress to the shared `statusMessage`, guarded by `isAlive` so a callback that fires after the node is torn down (RPCs resolve their status stream asynchronously) is a safe no-op.                                                                                                                                                            |
| [makeRegionStatusCallback](#method-makeregionstatuscallback)         | Methods    | [FetchMixin](../fetchmixin)                           | Per-region variant of `makeStatusCallback`: routes progress through `setRegionStatus(key, …)` so N concurrent per-region fetches aggregate into one status bar instead of clobbering each other.                                                                                                                                                                                                        |
| [throttleStatus](#action-throttlestatus)                             | Actions    | [FetchMixin](../fetchmixin)                           | Run `apply` only if the throttle window has elapsed.                                                                                                                                                                                                                                                                                                                                                    |
| [resetStatus](#action-resetstatus)                                   | Actions    | [FetchMixin](../fetchmixin)                           | Drop the active stop token and clear all status bookkeeping.                                                                                                                                                                                                                                                                                                                                            |
| [stopActiveFetch](#action-stopactivefetch)                           | Actions    | [FetchMixin](../fetchmixin)                           | Abort the in-flight fetch (if any) and clear its status.                                                                                                                                                                                                                                                                                                                                                |
| [setRegionStatus](#action-setregionstatus)                           | Actions    | [FetchMixin](../fetchmixin)                           | Record one concurrent operation's latest status (keyed) and recompute the shared statusMessage/statusProgress as the aggregate across all in-flight keys.                                                                                                                                                                                                                                               |
| [cancelFetch](#action-cancelfetch)                                   | Actions    | [FetchMixin](../fetchmixin)                           | cancel any in-flight fetch and bump fetchGeneration (always bumps, so callers can retrigger fetch autoruns even when nothing was in flight).                                                                                                                                                                                                                                                            |
| [cancelFetchByUser](#action-cancelfetchbyuser)                       | Actions    | [FetchMixin](../fetchmixin)                           | User-initiated cancel from the loading overlay.                                                                                                                                                                                                                                                                                                                                                         |
| [beforeDestroy](#action-beforedestroy)                               | Actions    | [FetchMixin](../fetchmixin)                           | Release an in-flight fetch's stop token on teardown.                                                                                                                                                                                                                                                                                                                                                    |
| [runFetch](#action-runfetch)                                         | Actions    | [FetchMixin](../fetchmixin)                           | Run a cancel-safe fetch (cancels any prior).                                                                                                                                                                                                                                                                                                                                                            |
| [rpcDataMap](#volatile-rpcdatamap)                                   | Volatiles  | [WiggleCommonMixin](../wigglecommonmixin)             |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [featureUnderMouse](#volatile-featureundermouse)                     | Volatiles  | [WiggleCommonMixin](../wigglecommonmixin)             |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [autoscaleSourceNames](#getter-autoscalesourcenames)                 | Getters    | [WiggleCommonMixin](../wigglecommonmixin)             | Source names to include when computing the autoscale domain; `undefined` means every fetched source.                                                                                                                                                                                                                                                                                                    |
| [visibleScoreStats](#getter-visiblescorestats)                       | Getters    | [WiggleCommonMixin](../wigglecommonmixin)             | The visible feature arrays plus their min/max/mean/stddev, walked once per domain recompute rather than once per autoscale input.                                                                                                                                                                                                                                                                       |
| [visibleScoreRange](#getter-visiblescorerange)                       | Getters    | [WiggleCommonMixin](../wigglecommonmixin)             |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [domain](#getter-domain)                                             | Getters    | [WiggleCommonMixin](../wigglecommonmixin)             |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setFeatureUnderMouse](#action-setfeatureundermouse)                 | Actions    | [WiggleCommonMixin](../wigglecommonmixin)             |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [selectFeature](#action-selectfeature)                               | Actions    | [WiggleCommonMixin](../wigglecommonmixin)             |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [resolution](#property-resolution)                                   | Properties | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [displayCrossHatches](#property-displaycrosshatches)                 | Properties | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [loadedBpPerPx](#volatile-loadedbpperpx)                             | Volatiles  | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [posColor](#getter-poscolor)                                         | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [negColor](#getter-negcolor)                                         | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [bicolorPivot](#getter-bicolorpivot)                                 | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [scaleType](#getter-scaletype)                                       | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [autoscaleType](#getter-autoscaletype)                               | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [numStdDev](#getter-numstddev)                                       | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [numQuantile](#getter-numquantile)                                   | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [scatterPointSize](#getter-scatterpointsize)                         | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [lineWidth](#getter-linewidth)                                       | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [summaryScoreMode](#getter-summaryscoremode)                         | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [renderingType](#getter-renderingtype)                               | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [minScore](#getter-minscore)                                         | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [maxScore](#getter-maxscore)                                         | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [minScoreBound](#getter-minscorebound)                               | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [maxScoreBound](#getter-maxscorebound)                               | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [hasResolution](#getter-hasresolution)                               | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [toggleCrossHatches](#action-togglecrosshatches)                     | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setResolution](#action-setresolution)                               | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setLoadedBpPerPx](#action-setloadedbpperpx)                         | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setScaleType](#action-setscaletype)                                 | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setBicolorPivot](#action-setbicolorpivot)                           | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setPosColor](#action-setposcolor)                                   | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   | Lives here beside the `posColor`/`negColor` getters and `setBicolorPivot` so both the single- and multi-wiggle color editors write the score-sign palette the same way.                                                                                                                                                                                                                                 |
| [setNegColor](#action-setnegcolor)                                   | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setMinScore](#action-setminscore)                                   | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setMaxScore](#action-setmaxscore)                                   | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setRenderingType](#action-setrenderingtype)                         | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setSummaryScoreMode](#action-setsummaryscoremode)                   | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setScatterPointSize](#action-setscatterpointsize)                   | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setLineWidth](#action-setlinewidth)                                 | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setAutoscale](#action-setautoscale)                                 | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                                                                                                                         |

<details>
<summary>LinearGCContentTrackDisplay - Properties</summary>

| Member                               | Type                                         |
| ------------------------------------ | -------------------------------------------- |
| <span id="property-type">type</span> | `ISimpleType<"LinearGCContentTrackDisplay">` |

</details>

<details>
<summary>LinearGCContentTrackDisplay - Getters</summary>

#### getter: adapterConfig

applies the current display parameter overrides to the parent GCContentTrack's
adapter.

The canonical config gives the track a GCContentAdapter (see the

```ts
type adapterConfig = any
```

**Example:**

_above), which is used as-is. But a GCContentTrack may also_

name a bare sequence adapter: that was the only shape that worked before the
display stopped wrapping unconditionally, and it shipped in our own volvox
configs long enough to be out in the wild. Wrapping it here keeps those configs
rendering — left unwrapped, the sequence adapter's featureless output reaches
the wiggle as an empty domain and the track draws an axis with no data, silently
and with no error.

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from SharedGCContentModel</summary>

[SharedGCContentModel →](../sharedgccontentmodel)

**Getters**

| Member                                           | Type  |
| ------------------------------------------------ | ----- |
| <span id="getter-windowsize">windowSize</span>   | `any` |
| <span id="getter-windowdelta">windowDelta</span> | `any` |
| <span id="getter-gcmode">gcMode</span>           | `any` |

**Methods**

| Member                                                 | Type                                                                                                                                                     |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="method-trackmenuitems">trackMenuItems</span> | `() => (MenuDivider \| MenuSubHeader \| NormalMenuItem \| CheckboxMenuItem \| RadioMenuItem \| SubMenuItem \| CustomMenuItem \| { ...; } \| { ...; })[]` |

**Actions**

| Member                                                         | Type                                                                                   |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| <span id="action-setgccontentparams">setGCContentParams</span> | `({ windowSize, windowDelta, }: { windowSize: number; windowDelta: number; }) => void` |
| <span id="action-setgcmode">setGCMode</span>                   | `(mode: "content" \| "skew") => void`                                                  |

</details>

<details>
<summary>Derived from LinearWiggleDisplay</summary>

[LinearWiggleDisplay →](../linearwiggledisplay)

**Properties**

| Member                                                 | Type                                                  |
| ------------------------------------------------------ | ----------------------------------------------------- |
| <span id="property-configuration">configuration</span> | `IConfigurationReference<AnyConfigurationSchemaType>` |

**Getters**

#### getter: prefersOffset

Offset the track label above the plot so the left y-axis stays pinned to the
content edge instead of dodging right of the label. Density mode draws no left
axis (just a top score legend), so let the label overlap.

```ts
type prefersOffset = boolean
```

#### getter: scoreRamp

The color ramp the density legend draws, or undefined when there is no single
ramp to describe. Lives on the model so the on-screen legend and the SVG export
can't disagree about whether density has a ramp.

Single-wiggle density always draws from posColor (the config doc for `color`
says so), so with bicolor off there is only one side to describe and the plain
[min, max] text stays the honest legend.

```ts
type scoreRamp =
  | { posColor: string; negColor: string; pivot: number; gradientId: string }
  | undefined
```

| Member                                                                   | Type                                                                           |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| <span id="getter-displaymessagecomponent">DisplayMessageComponent</span> | `LazyExoticComponent<({ model, }: { model: WiggleDisplayModel; }) => Element>` |
| <span id="getter-color">color</span>                                     | `string`                                                                       |
| <span id="getter-usebicolor">useBicolor</span>                           | `boolean`                                                                      |
| <span id="getter-isdensitymode">isDensityMode</span>                     | `boolean`                                                                      |
| <span id="getter-ticks">ticks</span>                                     | `YScaleTicks \| undefined`                                                     |
| <span id="getter-renderstate">renderState</span>                         | `WiggleGPURenderState`                                                         |

**Methods**

#### method: gpuProps

single-source gpuProps mapped onto the multi-source build path:

- bicolor: no source color override; build emits pos+neg with their respective
  colors
- solid: worker put all features in pos arrays (useBicolor=false); non-density
  modes use the user's color; density uses posColor (multi default, so leave
  source.color undefined)

Solid mode overrides `negColor` too, not just the source color. The worker's
pos/neg split only covers the 'avg' path; whiskers (the default
summaryScoreMode) re-derives the split on the main thread from bicolorPivot and
would otherwise paint every sub-pivot band in the negColor slot, so
`color: 'green'` on signed data came back green/red.

```ts
type gpuProps = () => { sources: {…}[]; posColor: string; negColor: string; summaryScoreMode: string; isDensityMode: boolean; renderingType: string; bicolorPivot: number; }
```

| Member                                     | Type                                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| <span id="method-rpcprops">rpcProps</span> | `() => { useBicolor: boolean; bicolorPivot: number; resolution: number; }` |

**Actions**

| Member                                                               | Type                                                                                                                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| <span id="action-setrpcdata">setRpcData</span>                       | `(displayedRegionIndex: number, data: WiggleDataResult) => void`                                                                                             |
| <span id="action-setusebicolor">setUseBicolor</span>                 | `(val?: boolean \| undefined) => void`                                                                                                                       |
| <span id="action-setcolor">setColor</span>                           | `(color?: string \| undefined) => void`                                                                                                                      |
| <span id="action-fetchneeded">fetchNeeded</span>                     | `(needed: { region: Region; displayedRegionIndex: number; }[]) => Promise<void>`                                                                             |
| <span id="action-rendersvg">renderSvg</span>                         | `(opts?: ExportSvgDisplayOptions \| undefined) => Promise<ReactElement<unknown, string \| JSXElementConstructor<any>> \| Iterable<...> \| AwaitedReactNode>` |
| <span id="action-startrenderingbackend">startRenderingBackend</span> | `(backend: WiggleRenderingBackend) => void`                                                                                                                  |

</details>

<details>
<summary>Derived from BaseDisplay</summary>

[BaseDisplay →](../basedisplay)

**Properties**

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

| Member                                                 | Type                                               |
| ------------------------------------------------------ | -------------------------------------------------- |
| <span id="property-id">id</span>                       | `IOptionalIType<ISimpleType<string>, [undefined]>` |
| <span id="property-rpcdrivername">rpcDriverName</span> | `IMaybe<ISimpleType<string>>`                      |

**Volatiles**

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

| Member                                                 | Type                  |
| ------------------------------------------------------ | --------------------- |
| <span id="volatile-error">error</span>                 | `unknown`             |
| <span id="volatile-statusmessage">statusMessage</span> | `string \| undefined` |

**Getters**

#### getter: parentDisplay

Returns the parent display if this display is nested within another display
(e.g., PileupDisplay inside LinearAlignmentsDisplay)

```ts
type parentDisplay =
  | { type?: string | undefined; effectiveRpcDriverName?: string | undefined }
  | undefined
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

| Member                                                         | Type                                                                                            |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| <span id="getter-parenttrack">parentTrack</span>               | `AbstractTrackModel`                                                                            |
| <span id="getter-renderingcomponent">RenderingComponent</span> | `FC<…>`                                                                                         |
| <span id="getter-displayblurb">DisplayBlurb</span>             | `FC<{ model: ModelInstanceTypeProps<…> & { ...; } & { ...; } & IStateTreeNode<...>; }> \| null` |

**Methods**

#### method: renderingProps

props passed to the renderer's React "Rendering" component. these are
client-side only and never sent to the worker. includes displayModel and
callbacks

```ts
type renderingProps = () => { displayModel: ModelInstanceTypeProps<…> & { ...; } & { ...; } & { ...; } & IStateTreeNode<...>; }
```

**Actions**

#### action: setIgnorePromotedDefaults

see the `ignorePromotedDefaults` property

```ts
type setIgnorePromotedDefaults = (flag: boolean) => void
```

#### action: reload

base display reload does nothing, see specialized displays for details

```ts
type reload = () => void
```

| Member                                                     | Type                                        |
| ---------------------------------------------------------- | ------------------------------------------- |
| <span id="action-setstatusmessage">setStatusMessage</span> | `(status?: RpcStatus \| undefined) => void` |
| <span id="action-seterror">setError</span>                 | `(error?: unknown) => void`                 |
| <span id="action-setrpcdrivername">setRpcDriverName</span> | `(rpcDriverName: string) => void`           |

</details>

<details>
<summary>Derived from TrackHeightMixin</summary>

[TrackHeightMixin →](../trackheightmixin)

**Volatiles**

| Member                                         | Type     |
| ---------------------------------------------- | -------- |
| <span id="volatile-scrolltop">scrollTop</span> | `number` |

**Getters**

| Member                                 | Type     |
| -------------------------------------- | -------- |
| <span id="getter-height">height</span> | `number` |

**Actions**

| Member                                             | Type                                |
| -------------------------------------------------- | ----------------------------------- |
| <span id="action-setscrolltop">setScrollTop</span> | `(scrollTop: number) => void`       |
| <span id="action-setheight">setHeight</span>       | `(displayHeight: number) => number` |
| <span id="action-resizeheight">resizeHeight</span> | `(distance: number) => number`      |

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

#### getter: canRender

The render-lifecycle precondition for every LGV display (overrides
`RenderLifecycleMixin`'s default-true hook): don't run the upload/render
callbacks until the view is measured. Before that, `renderBlocks` →
`visibleRegions` → `view.width` throws by design, and the render autorun's catch
would show that as a GPU render-error banner. Gating here — once, for all of
them — is what lets a display's `renderState` be a plain resolved getter and its
render callback gate only on its own data. The render-lifecycle twin of
`autorunOnReadyView`.

```ts
type canRender = boolean
```

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

#### getter: dataCurrent

This family's answer to the shared freshness question every display foundation
must answer (`dataCurrent`): the held data corresponds to what is on screen
right now. Here that is spatial — every visible block lies within a fetched
region — plus `loadedRegions.size`, which rules out the vacuously-true empty
viewport. Regions stream in one at a time, so this (not "the first datum
arrived") is what keeps a multi-region/whole-genome export complete.

Distinct from `viewportWithinLoadedData`, which is the raw coverage predicate
the fetch autorun and the loading overlay use.

```ts
type dataCurrent = boolean
```

#### getter: svgReady

true once an off-screen (SVG) export can safely read this display's data. Policy
single-sourced in `computeSvgReady`; this family supplies only its `dataCurrent`
predicate. Off-screen renderers gate on it via `awaitSvgReady(model)` instead of
inlining the condition.

```ts
type svgReady = boolean
```

#### getter: svgReadyExtraTerminal

Overridable hook (default false): a subclass returns true to mark an extra
terminal state where off-screen export can proceed with no loaded data. Sequence
sets it when zoomed past base resolution — it renders a static "zoom in" message
and fetches nothing, so `svgReady` would otherwise never resolve.

```ts
type svgReadyExtraTerminal = boolean
```

#### getter: layoutReady

Overridable hook (default false): whether a searchable feature layout currently
exists. Any display defining a feature-lookup method (`searchFeatureByID`,
`getFeatureById`) must override it, so callers can tell "laid out, but
off-display" from "no layout exists yet" — a distinction only the display can
make. See BaseLinearDisplay/CLAUDE.md, "The three readiness axes".

```ts
type layoutReady = boolean
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

#### getter: displayPhase

The display's mutually-exclusive visual state, precedence single-sourced in
`computeDisplayPhase`. Here `loading` means data isn't ready yet, or stale data
(viewport past loaded) is still on screen through the pre-refetch debounce.

```ts
type displayPhase = DisplayPhase
```

#### getter: rpcPropsCacheKey

The RPC cache key watched by `SettingsInvalidate` — the subclass's `rpcProps()`
payload serialized to a string. `serializeRpcProps` owns the why;
`installGlobalFetchAutorun` keys its global-family counterpart on the same
function, so the two families invalidate on the same axis.

```ts
type rpcPropsCacheKey = string
```

**Methods**

#### method: isCacheValid

Overridable hook: return `false` to force re-fetch at the current zoom (wiggle
uses this for zoom-level changes).

```ts
type isCacheValid = (_displayedRegionIndex: number) => boolean
```

**Actions**

#### action: setLoadedRegion

Action wrapper so callers after async boundaries stay in MST strict mode.

```ts
type setLoadedRegion = (displayedRegionIndex: number, region: Region) => void
```

#### action: clearDisplaySpecificData

no-op base — subclasses override to clear rpcDataMap etc.

```ts
type clearDisplaySpecificData = () => void
```

#### action: clearAllRpcData

full reset: cancels fetch, clears error, loadedRegions, display-specific data,
and the canvas-drawn flag. The too-large gate is derived (a pure function of the
cached estimate × viewport), so it needs no explicit clear here — it
self-releases when the viewport changes.

```ts
type clearAllRpcData = () => void
```

#### action: invalidateLoadedRegions

lighter reset: cancels fetch and clears loadedRegions, leaving error and
regionTooLarge intact

```ts
type invalidateLoadedRegions = () => void
```

#### action: onRegionTooLarge

Overridable hook (no-op base): called when `regionTooLarge` transitions to true.
Displays with transient hover/tooltip state override it to clear that state —
the too-large banner replaces the rendered content, so a lingering hover would
otherwise pin to a now-hidden feature. Wired to the `ClearHoverOnRegionTooLarge`
autorun, fired by the derived too-large gate.

```ts
type onRegionTooLarge = () => void
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

installs the five fetch-lifecycle autoruns (DisplayedRegionsChange,
FetchVisibleRegions, SettingsInvalidate, ClearBlockingStateOnViewportChange,
ClearHoverOnRegionTooLarge)

```ts
type afterAttach = () => void
```

</details>

<details>
<summary>Derived from RegionTooLargeMixin</summary>

[RegionTooLargeMixin →](../regiontoolargemixin)

**Volatiles**

#### volatile: forceLoadTrack

The force-load button's answer: render this track regardless of region size or
feature density. One boolean for the whole track, not a raised ceiling per
region — the banner already tells the user how much data is involved, so one
informed click approves the track and they never have to re-approve it per
locus.

Volatile, not persisted, so it can't leak a disabled gate into a saved or shared
session (a recipient would download the same data with no warning and no way to
see why). A page load re-arms the gate. The durable, declarative equivalent is
the `forceLoad` config slot, for session specs, embeds and
`jbrowse-img --force`.

```ts
// type signature
type forceLoadTrack = false
// code
forceLoadTrack: false
```

#### volatile: byteEstimate

The last byte measurement for this display: the estimated bytes **and the span
they cover**, which is what lets the derived gate rescale them to the span on
screen now. One volatile rather than two, because the pair is a single
measurement — written together by `setByteEstimate`, dropped together by
`clearByteEstimate`, and meaningless apart. Survives `clearAllRpcData` so an
ordinary viewport change doesn't flicker the banner; only chromosome navigation
drops it. Ignored unless `derivedRegionTooLargeEnabled`.

```ts
// type signature
type byteEstimate = ByteEstimate | undefined
// code
byteEstimate: undefined as ByteEstimate | undefined
```

**Getters**

#### getter: gateFoldedIntoFetch

Additive opt-in for displays that measure the estimate inside their own feature
RPC instead of a pre-flight (canvas). Kept separate from
`derivedRegionTooLargeEnabled` so a gate mixin contributes by setting _this_
rather than overriding the verdict switch — the two would otherwise race on
composition order, and the later `.compose()` argument silently winning is
invisible to both the type system and the tests.

```ts
type gateFoldedIntoFetch = boolean
```

#### getter: byteGateEnabled

The one opt-in a pre-flight display writes: true means "measure this fetch and
gate on it". `byteGateBlocksFetch` reads it (so a display that calls the gate
unconditionally still pays no RPC when it's off) and so does the verdict, which
is why requesting the estimate and gating on it can't drift apart. MAF flips it
off in summary mode, LD for pre-computed adapters.

```ts
type byteGateEnabled = boolean
```

#### getter: configuredFetchSizeLimit

The composing display's configured `fetchSizeLimit`, read straight from its
config. Only evaluated when the derived gate is enabled (guarded by
`derivedRegionTooLargeEnabled`), and every derived display extends
`baseLinearDisplayConfigSchema`, which owns the slot — so the read is always
valid where it fires. A display with a bespoke source can still override it.

```ts
type configuredFetchSizeLimit = number
```

#### getter: densityTooLarge

Second (non-byte) too-large axis folded into the derived verdict — canvas
overrides it with its feature-density gate. Byte-only derived displays leave it
false.

```ts
type densityTooLarge = boolean
```

#### getter: adapterFetchSizeLimit

The adapter's own `fetchSizeLimit` slot (undefined when the adapter type
declares none); `resolveByteLimit` prefers it over the display config. Read on
the main thread, and only here — the estimate that crosses the worker boundary
carries bytes and nothing else, so the banner and the worker budget have no
second spelling of "the adapter's limit" to disagree about.

A slot **path off the live config**, not a read off `self.adapterConfig`: that
getter is a snapshot, which by design omits slots sitting at their default, so a
BAM's declared 5 Mb read back as `undefined` in every config that doesn't
restate it. Resolved values come from a config node — see CONFIG_PATTERN.md
§"Reading a slot: node, not snapshot".

```ts
type adapterFetchSizeLimit = number | undefined
```

#### getter: configForceLoad

Declarative force-load: when true the display always renders regardless of
region size / feature density (the config-driven equivalent of the force-load
button). Read straight from the `forceLoad` config slot on
`baseLinearDisplayConfigSchema` (same guard/ownership as
`configuredFetchSizeLimit`), so every opt-in display honors it without
per-display wiring.

```ts
type configForceLoad = boolean
```

#### getter: gateVisibleBp

The span on screen, or undefined before the view is measured. The gate's only
read of its container: `visibleBp` reads `view.width`, which throws before
measurement and a bare getter must never throw, so the pre-init guard lives here
once rather than at each reader.

```ts
type gateVisibleBp = number | undefined
```

#### getter: derivedRegionTooLargeEnabled

Whether the derived, self-releasing gate is live at all — the union of the two
ways a display can measure: a pre-flight estimate (`byteGateEnabled`) or a byte
check folded into its own feature RPC (`gateFoldedIntoFetch`). Additive, never
an override, so a gate mixin's opt-in doesn't hinge on which side of
`.compose()` it lands on. False for the non-byte displays (wiggle, manhattan,
sequence, synteny), which therefore never evaluate the LGV-only `tooLargeStatus`
getters.

```ts
type derivedRegionTooLargeEnabled = boolean
```

#### getter: byteGateExempt

True when nothing may gate, on either axis and in both the worker and the
banner: the declarative `forceLoad` slot, or the force-load button. One boolean
is the whole force-load mechanism — there is no per-region ceiling to carry,
expire, or reconcile between the two axes. A self-summarizing adapter (BigWig,
HiC, sequence) needs no term here: it reports no byte estimate at all, which
already keeps the byte axis out of the verdict.

```ts
type byteGateExempt = boolean
```

#### getter: estimatedBytesForVisibleSpan

How many bytes we estimate a fetch of the span on screen right now would pull,
obtained by rescaling the stored measurement from the span it covers. Rescaling
is what makes the derived verdict a pure function of the current view and lets
it self-release on zoom-in — without it a large zoomed-out estimate stays above
the limit forever and gates refetch. Only meaningful when
`derivedRegionTooLargeEnabled`.

```ts
type estimatedBytesForVisibleSpan = number | undefined
```

#### getter: gateByteLimit

The byte budget the gate enforces: the adapter's limit, else the display config.
Also what `resolvedByteLimit()` hands the worker, so the two can't gate against
different numbers. Force-load doesn't raise this — it exempts the track outright
via `byteGateExempt`.

```ts
type gateByteLimit = number
```

#### getter: gateActive

Whether anything may gate at this moment: the display opted in, nothing exempts
it, and the view is measured and wider than the `AUTO_FORCE_LOAD_BP` force-load
floor.

The single home of that question. Everything downstream reads it instead of
restating it: the verdict, the pre-flight (no estimate RPC when nothing could
act on it), and the worker budgets, which go undefined together here rather than
each re-deriving the floor. The floor used to be spelled out in three places at
three layers, which is a standing invitation for them to disagree.

```ts
type gateActive = boolean
```

#### getter: tooLargeStatus

The verdict the whole mixin exists to produce, with the banner text: true when
the estimated download for the span on screen exceeds the resolved byte budget,
or when the display's own density axis trips (bytes take precedence for the
text). Derived from the rescaled estimate, so it releases itself on zoom-in;
false whenever `gateActive` is false.

The fetch autoruns hold off while `regionTooLarge` is true, and `DisplayChrome`
renders the banner from `regionTooLargeReason`.

```ts
type tooLargeStatus = RegionTooLargeStatus
```

#### getter: regionTooLargeReason

Which axis tripped, as banner text: the estimated download size, or "Too many
features". Empty string when the region isn't too large.

```ts
type regionTooLargeReason = string
```

| Member                                                 | Type      |
| ------------------------------------------------------ | --------- |
| <span id="getter-regiontoolarge">regionTooLarge</span> | `boolean` |

**Methods**

#### method: resolvedByteLimit

The byte budget a fetch RPC enforces worker-side, short-circuiting an
over-budget region before it downloads any features. Undefined (unlimited) when
nothing gates; otherwise the very number the banner compares against, so the
worker can't reject a region the banner then calls fine. Lives here, not on the
canvas gate that consumes it, because both its terms are this mixin's — canvas
owns only the density axis.

```ts
type resolvedByteLimit = () => number | undefined
```

**Actions**

#### action: setByteEstimate

Commits a byte measurement: the estimate together with the span it covers, so
the derived gate can rescale it to the span on screen. `measuredSpanBp` must be
the `visibleBp` captured when the measurement was _requested_, not read at
commit time: a view that zoomed during the in-flight fetch would otherwise
anchor the estimate to a span it never covered, and since `FetchVisibleRegions`
skips while `regionTooLarge` holds, an over-anchored estimate wedges the banner
with no refetch to correct it. Harmless for non-gated displays (they ignore it).

```ts
type setByteEstimate = (estimate: ByteEstimate) => void
```

#### action: clearByteEstimate

Drops the cached estimate. Chromosome navigation only: the estimate
intentionally survives `clearAllRpcData` so an ordinary viewport change doesn't
flicker the banner.

`forceLoadTrack` deliberately survives: it is a track-wide approval, so expiring
it on navigation is exactly the per-locus re-approval the button exists to
avoid.

```ts
type clearByteEstimate = () => void
```

#### action: setForceLoadTrack

Exempt this track from the gate (or put it back under it). Separate from
`forceLoad` so turning the gate off and refetching stay separable — a caller
that just wants the flag (a revoke, a test) doesn't trigger a fetch, and
`forceLoad` doesn't have to inline a volatile write.

```ts
type setForceLoadTrack = (flag: boolean) => void
```

#### action: forceLoad

Force-load: exempt this track from the gate and refetch. One click covers every
region and both axes, informed by the size the banner just quoted. The display
chrome calls this from TooLargeMessage's button; concrete display models
override `reload()` to do the actual refetch.

```ts
type forceLoad = () => void
```

#### action: byteGateBlocksFetch

The entire pre-flight gate for one fetch: measure the region set, commit the
estimate with the span it covers, and answer whether the caller must abandon the
fetch — either superseded mid-measure, or over budget.

Every pre-flight caller (`fetchRegions` for the MultiRegionDisplayMixin family,
LD and arc from their own global fetches) calls this and returns on true.
Sequencing the steps at a call site is what used to go wrong: the span is read
here, _before_ the await, so the estimate is anchored to the span it actually
covers — a re-read afterwards would pin it to whatever a mid-fetch zoom left on
screen, and since the fetch autoruns skip while `regionTooLarge` holds, an
over-anchored estimate wedges the banner with no refetch to correct it.

```ts
type byteGateBlocksFetch = (
  regions: {
    refName: string
    start: number
    end: number
    assemblyName: string
  }[],
  ctx: { isStale: () => boolean },
) => Promise<boolean>
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

| Member                                                             | Type         |
| ------------------------------------------------------------------ | ------------ |
| <span id="action-markcanvasdrawn">markCanvasDrawn</span>           | `() => void` |
| <span id="action-resetcanvasdrawn">resetCanvasDrawn</span>         | `() => void` |
| <span id="action-stoprenderingbackend">stopRenderingBackend</span> | `() => void` |
| <span id="action-rendernow">renderNow</span>                       | `() => void` |

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
status bar instead of clobbering each other. Same `isAlive` guard;
`setRegionStatus` owns the throttling (it has to thin only the bar write, not
the per-region bookkeeping).

```ts
type makeRegionStatusCallback = (key: number) => (status: RpcStatus) => void
```

**Actions**

#### action: throttleStatus

Run `apply` only if the throttle window has elapsed.

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

#### action: beforeDestroy

Release an in-flight fetch's stop token on teardown. Without this, a display
destroyed mid-fetch (track/view closed while loading) never revokes its token —
a blob-URL leak on the non-SAB fallback path — and never signals the worker to
abort the now-useless work. MST auto-chains lifecycle hooks, so a composing
display can still define its own beforeDestroy.

```ts
type beforeDestroy = () => void
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

<details>
<summary>Derived from WiggleCommonMixin</summary>

[WiggleCommonMixin →](../wigglecommonmixin)

**Volatiles**

| Member                                                         | Type                                      |
| -------------------------------------------------------------- | ----------------------------------------- |
| <span id="volatile-rpcdatamap">rpcDataMap</span>               | `ObservableMap<number, WiggleDataResult>` |
| <span id="volatile-featureundermouse">featureUnderMouse</span> | `WiggleFeatureUnderMouse \| undefined`    |

**Getters**

#### getter: autoscaleSourceNames

Source names to include when computing the autoscale domain; `undefined` means
every fetched source. Multi-wiggle always fetches all sources and filters
client-side, so it overrides this to the visible subset — otherwise a subtree
filter that hides sources would leave the Y-axis scaled to the hidden ones.

```ts
type autoscaleSourceNames = Set<string> | undefined
```

#### getter: visibleScoreStats

The visible feature arrays plus their min/max/mean/stddev, walked once per
domain recompute rather than once per autoscale input.

```ts
type visibleScoreStats =
  | {
      entries: { visStart: number; visEnd: number; data: WiggleSourceData }[]
      stats: ScoreStats | undefined
    }
  | undefined
```

| Member                                                       | Type                            |
| ------------------------------------------------------------ | ------------------------------- |
| <span id="getter-visiblescorerange">visibleScoreRange</span> | `[number, number] \| undefined` |
| <span id="getter-domain">domain</span>                       | `[number, number] \| undefined` |

**Actions**

| Member                                                             | Type                                                    |
| ------------------------------------------------------------------ | ------------------------------------------------------- |
| <span id="action-setfeatureundermouse">setFeatureUnderMouse</span> | `(feat?: WiggleFeatureUnderMouse \| undefined) => void` |
| <span id="action-selectfeature">selectFeature</span>               | `(feat: WiggleFeatureUnderMouse) => void`               |

</details>

<details>
<summary>Derived from WiggleScoreConfigMixin</summary>

[WiggleScoreConfigMixin →](../wigglescoreconfigmixin)

**Properties**

| Member                                                             | Type                                                |
| ------------------------------------------------------------------ | --------------------------------------------------- |
| <span id="property-resolution">resolution</span>                   | `IOptionalIType<ISimpleType<number>, [undefined]>`  |
| <span id="property-displaycrosshatches">displayCrossHatches</span> | `IOptionalIType<ISimpleType<boolean>, [undefined]>` |

**Volatiles**

| Member                                                 | Type                  |
| ------------------------------------------------------ | --------------------- |
| <span id="volatile-loadedbpperpx">loadedBpPerPx</span> | `number \| undefined` |

**Getters**

| Member                                                     | Type                  |
| ---------------------------------------------------------- | --------------------- |
| <span id="getter-poscolor">posColor</span>                 | `string`              |
| <span id="getter-negcolor">negColor</span>                 | `string`              |
| <span id="getter-bicolorpivot">bicolorPivot</span>         | `number`              |
| <span id="getter-scaletype">scaleType</span>               | `string`              |
| <span id="getter-autoscaletype">autoscaleType</span>       | `string`              |
| <span id="getter-numstddev">numStdDev</span>               | `number`              |
| <span id="getter-numquantile">numQuantile</span>           | `number`              |
| <span id="getter-scatterpointsize">scatterPointSize</span> | `number`              |
| <span id="getter-linewidth">lineWidth</span>               | `number`              |
| <span id="getter-summaryscoremode">summaryScoreMode</span> | `string`              |
| <span id="getter-renderingtype">renderingType</span>       | `string`              |
| <span id="getter-minscore">minScore</span>                 | `number`              |
| <span id="getter-maxscore">maxScore</span>                 | `number`              |
| <span id="getter-minscorebound">minScoreBound</span>       | `number \| undefined` |
| <span id="getter-maxscorebound">maxScoreBound</span>       | `number \| undefined` |
| <span id="getter-hasresolution">hasResolution</span>       | `boolean`             |

**Actions**

#### action: setPosColor

Lives here beside the `posColor`/`negColor` getters and `setBicolorPivot` so
both the single- and multi-wiggle color editors write the score-sign palette the
same way.

```ts
type setPosColor = (color?: string | undefined) => void
```

| Member                                                           | Type                                     |
| ---------------------------------------------------------------- | ---------------------------------------- |
| <span id="action-togglecrosshatches">toggleCrossHatches</span>   | `() => void`                             |
| <span id="action-setresolution">setResolution</span>             | `(res: number) => void`                  |
| <span id="action-setloadedbpperpx">setLoadedBpPerPx</span>       | `(bpPerPx: number \| undefined) => void` |
| <span id="action-setscaletype">setScaleType</span>               | `(scaleType: string) => void`            |
| <span id="action-setbicolorpivot">setBicolorPivot</span>         | `(val?: number \| undefined) => void`    |
| <span id="action-setnegcolor">setNegColor</span>                 | `(color?: string \| undefined) => void`  |
| <span id="action-setminscore">setMinScore</span>                 | `(val?: number \| undefined) => void`    |
| <span id="action-setmaxscore">setMaxScore</span>                 | `(val?: number \| undefined) => void`    |
| <span id="action-setrenderingtype">setRenderingType</span>       | `(type: string) => void`                 |
| <span id="action-setsummaryscoremode">setSummaryScoreMode</span> | `(val: string) => void`                  |
| <span id="action-setscatterpointsize">setScatterPointSize</span> | `(val?: number \| undefined) => void`    |
| <span id="action-setlinewidth">setLineWidth</span>               | `(val?: number \| undefined) => void`    |
| <span id="action-setautoscale">setAutoscale</span>               | `(val?: string \| undefined) => void`    |

</details>
