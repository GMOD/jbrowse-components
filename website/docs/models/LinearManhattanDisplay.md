---
id: linearmanhattandisplay
title: LinearManhattanDisplay
sidebar_label: Display -> LinearManhattanDisplay
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`gwas` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gwas/src/LinearManhattanDisplay/stateModelFactory.ts).

## Overview

GWAS Manhattan-plot display drawing -log10 p-values as a scored scatter along
the genome, with a feature widget on click.

## Members

| Member                                                                 | Kind       | Defined by                                            | Description                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------- | ---------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [type](#property-type)                                                 | Properties | LinearManhattanDisplay                                |                                                                                                                                                                                                                                                                                                    |
| [configuration](#property-configuration)                               | Properties | LinearManhattanDisplay                                |                                                                                                                                                                                                                                                                                                    |
| [indexSnp](#property-indexsnp)                                         | Properties | LinearManhattanDisplay                                | Index/lead SNP for LD coloring — a SNP id or `chr:bp` (1-based) string.                                                                                                                                                                                                                            |
| [indexSnpPinned](#property-indexsnppinned)                             | Properties | LinearManhattanDisplay                                | True once the user pins a specific index SNP (right-clicking a point).                                                                                                                                                                                                                             |
| [rpcDataMap](#volatile-rpcdatamap)                                     | Volatiles  | LinearManhattanDisplay                                |                                                                                                                                                                                                                                                                                                    |
| [flatbushes](#volatile-flatbushes)                                     | Volatiles  | LinearManhattanDisplay                                |                                                                                                                                                                                                                                                                                                    |
| [featureUnderMouse](#volatile-featureundermouse)                       | Volatiles  | LinearManhattanDisplay                                |                                                                                                                                                                                                                                                                                                    |
| [showLdLegend](#volatile-showldlegend)                                 | Volatiles  | LinearManhattanDisplay                                |                                                                                                                                                                                                                                                                                                    |
| [view](#getter-view)                                                   | Getters    | LinearManhattanDisplay                                | the containing LGV, typed once here so downstream getters don't repeat the `getContainingView` cast                                                                                                                                                                                                |
| [DisplayMessageComponent](#getter-displaymessagecomponent)             | Getters    | LinearManhattanDisplay                                |                                                                                                                                                                                                                                                                                                    |
| [prefersOffset](#getter-prefersoffset)                                 | Getters    | LinearManhattanDisplay                                | Offset the track label above the plot so the -log10(p) y-axis stays pinned to the content edge instead of dodging right of the label.                                                                                                                                                              |
| [TooltipComponent](#getter-tooltipcomponent)                           | Getters    | LinearManhattanDisplay                                |                                                                                                                                                                                                                                                                                                    |
| [color](#getter-color)                                                 | Getters    | LinearManhattanDisplay                                | resolved point color                                                                                                                                                                                                                                                                               |
| [colorBy](#getter-colorby)                                             | Getters    | LinearManhattanDisplay                                | resolved coloring mode: 'normal' uses `color`, 'ld' colors by r² to the index SNP                                                                                                                                                                                                                  |
| [ldAdapterConfig](#getter-ldadapterconfig)                             | Getters    | LinearManhattanDisplay                                | the PLINK .ld sub-adapter configured on the track's `GWASAdapter`, or undefined when none is set (the slot defaults to null, normalized here to undefined for "absent")                                                                                                                            |
| [hasLdData](#getter-haslddata)                                         | Getters    | LinearManhattanDisplay                                | LD coloring needs a configured .ld adapter; without one the colorBy='ld' controls are inert, so they're hidden/disabled                                                                                                                                                                            |
| [ldColoringActive](#getter-ldcoloringactive)                           | Getters    | LinearManhattanDisplay                                | LD coloring is actually in effect — the mode is on _and_ there's an .ld adapter for it to read.                                                                                                                                                                                                    |
| [domain](#getter-domain)                                               | Getters    | LinearManhattanDisplay                                | nice-rounded [min, max] -log10 p domain across loaded regions, or undefined before any data loads                                                                                                                                                                                                  |
| [ticks](#getter-ticks)                                                 | Getters    | LinearManhattanDisplay                                | y-axis tick positions.                                                                                                                                                                                                                                                                             |
| [renderState](#getter-renderstate)                                     | Getters    | LinearManhattanDisplay                                | render geometry for the inner canvas (between top/bottom YScaleBar label offsets) — the area both the GPU renderer and findManhattanHit work in.                                                                                                                                                   |
| [regionRefNames](#getter-regionrefnames)                               | Getters    | LinearManhattanDisplay                                | displayedRegionIndex → refName lookup.                                                                                                                                                                                                                                                             |
| [topSnp](#getter-topsnp)                                               | Getters    | LinearManhattanDisplay                                | highest-scoring loaded SNP as a `chr:bp` (1-based) string — the default LD index SNP.                                                                                                                                                                                                              |
| [indexSnpMissing](#getter-indexsnpmissing)                             | Getters    | LinearManhattanDisplay                                | true when LD coloring is active with data loaded, but no region's LD data referenced the index SNP — so every point is grey.                                                                                                                                                                       |
| [indexSnpOffscreen](#getter-indexsnpoffscreen)                         | Getters    | LinearManhattanDisplay                                | When the index SNP is a `chr:bp` locus, whether it lies outside every visible region — the benign, pannable cause of `indexSnpMissing` (PLINK `--ld-window` files carry no records once you pan away from the index), as opposed to reference-name aliasing or the SNP being absent from the file. |
| [rpcProps](#method-rpcprops)                                           | Methods    | LinearManhattanDisplay                                | fetch inputs watched by SettingsInvalidate — any change (color, colorBy, index SNP, LD adapter) triggers a refetch, since the worker bakes per-feature color into the result                                                                                                                       |
| [trackMenuItems](#method-trackmenuitems)                               | Methods    | LinearManhattanDisplay                                | Manhattan track menu: shared Score submenu plus LD-coloring controls.                                                                                                                                                                                                                              |
| [contextMenuItems](#method-contextmenuitems)                           | Methods    | LinearManhattanDisplay                                | right-click menu for a clicked point: feature details plus, when an LD adapter is configured, a shortcut to recolor by LD to that SNP                                                                                                                                                              |
| [selectFeature](#action-selectfeature)                                 | Actions    | LinearManhattanDisplay                                | open the feature details widget for a clicked point                                                                                                                                                                                                                                                |
| [setRpcData](#action-setrpcdata)                                       | Actions    | LinearManhattanDisplay                                |                                                                                                                                                                                                                                                                                                    |
| [setFeatureUnderMouse](#action-setfeatureundermouse)                   | Actions    | LinearManhattanDisplay                                |                                                                                                                                                                                                                                                                                                    |
| [setShowLdLegend](#action-setshowldlegend)                             | Actions    | LinearManhattanDisplay                                |                                                                                                                                                                                                                                                                                                    |
| [setColorBy](#action-setcolorby)                                       | Actions    | LinearManhattanDisplay                                |                                                                                                                                                                                                                                                                                                    |
| [setIndexSnp](#action-setindexsnp)                                     | Actions    | LinearManhattanDisplay                                |                                                                                                                                                                                                                                                                                                    |
| [colorByLdToHit](#action-colorbyldtohit)                               | Actions    | LinearManhattanDisplay                                | right-click "Color by LD to this SNP": switch into LD mode and pin the index on the clicked point, so the auto-pick stops tracking the top hit.                                                                                                                                                    |
| [useTopHitAsIndex](#action-usetophitasindex)                           | Actions    | LinearManhattanDisplay                                | release a pinned index back to auto-tracking, seeded at the current top hit (the auto-pick autorun then keeps it on the top hit as data loads)                                                                                                                                                     |
| [clearDisplaySpecificData](#action-cleardisplayspecificdata)           | Actions    | LinearManhattanDisplay                                |                                                                                                                                                                                                                                                                                                    |
| [fetchNeeded](#action-fetchneeded)                                     | Actions    | LinearManhattanDisplay                                | Manhattan features are 1:1 with the underlying SNPs (pre-transformed -log10 p values) and don't downsample by zoom, so we never need to refetch on bpPerPx change.                                                                                                                                 |
| [renderSvg](#action-rendersvg)                                         | Actions    | LinearManhattanDisplay                                |                                                                                                                                                                                                                                                                                                    |
| [startRenderingBackend](#action-startrenderingbackend)                 | Actions    | LinearManhattanDisplay                                | identity encode — RPC result is the upload payload                                                                                                                                                                                                                                                 |
| [id](#property-id)                                                     | Properties | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                    |
| [rpcDriverName](#property-rpcdrivername)                               | Properties | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                    |
| [ignorePromotedDefaults](#property-ignorepromoteddefaults)             | Properties | [BaseDisplay](../basedisplay)                         | true for a display that arrived inside a session received from someone else (a share link, an encoded/json session, a `spec-` URL).                                                                                                                                                                |
| [error](#volatile-error)                                               | Volatiles  | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                    |
| [statusMessage](#volatile-statusmessage)                               | Volatiles  | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                    |
| [statusProgress](#volatile-statusprogress)                             | Volatiles  | [BaseDisplay](../basedisplay)                         | determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate.                                                                                                                                                                                |
| [parentTrack](#getter-parenttrack)                                     | Getters    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                    |
| [parentDisplay](#getter-parentdisplay)                                 | Getters    | [BaseDisplay](../basedisplay)                         | Returns the parent display if this display is nested within another display (e.g., PileupDisplay inside LinearAlignmentsDisplay)                                                                                                                                                                   |
| [RenderingComponent](#getter-renderingcomponent)                       | Getters    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                    |
| [DisplayBlurb](#getter-displayblurb)                                   | Getters    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                    |
| [adapterConfig](#getter-adapterconfig)                                 | Getters    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                    |
| [isMinimized](#getter-isminimized)                                     | Getters    | [BaseDisplay](../basedisplay)                         | Returns true if the parent track is minimized.                                                                                                                                                                                                                                                     |
| [effectiveRpcDriverName](#getter-effectiverpcdrivername)               | Getters    | [BaseDisplay](../basedisplay)                         | Returns the effective RPC driver name with hierarchical fallback: 1.                                                                                                                                                                                                                               |
| [renderingProps](#method-renderingprops)                               | Methods    | [BaseDisplay](../basedisplay)                         | props passed to the renderer's React "Rendering" component.                                                                                                                                                                                                                                        |
| [regionCannotBeRendered](#method-regioncannotberendered)               | Methods    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                    |
| [setIgnorePromotedDefaults](#action-setignorepromoteddefaults)         | Actions    | [BaseDisplay](../basedisplay)                         | see the `ignorePromotedDefaults` property                                                                                                                                                                                                                                                          |
| [setStatusMessage](#action-setstatusmessage)                           | Actions    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                    |
| [setError](#action-seterror)                                           | Actions    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                    |
| [setRpcDriverName](#action-setrpcdrivername)                           | Actions    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                    |
| [reload](#action-reload)                                               | Actions    | [BaseDisplay](../basedisplay)                         | base display reload does nothing, see specialized displays for details                                                                                                                                                                                                                             |
| [scrollTop](#volatile-scrolltop)                                       | Volatiles  | [TrackHeightMixin](../trackheightmixin)               |                                                                                                                                                                                                                                                                                                    |
| [height](#getter-height)                                               | Getters    | [TrackHeightMixin](../trackheightmixin)               |                                                                                                                                                                                                                                                                                                    |
| [setScrollTop](#action-setscrolltop)                                   | Actions    | [TrackHeightMixin](../trackheightmixin)               |                                                                                                                                                                                                                                                                                                    |
| [setHeight](#action-setheight)                                         | Actions    | [TrackHeightMixin](../trackheightmixin)               |                                                                                                                                                                                                                                                                                                    |
| [resizeHeight](#action-resizeheight)                                   | Actions    | [TrackHeightMixin](../trackheightmixin)               |                                                                                                                                                                                                                                                                                                    |
| [loadedRegions](#volatile-loadedregions)                               | Volatiles  | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | regions whose data has been fetched and committed, keyed by displayedRegionIndex; populated only after the fetch work callback returns                                                                                                                                                             |
| [isReady](#getter-isready)                                             | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | true once the canvas has painted and no fetch is in flight                                                                                                                                                                                                                                         |
| [viewportWithinLoadedData](#getter-viewportwithinloadeddata)           | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | true when every visible block lies within an already-fetched region — i.e. the viewport shows data we actually loaded, not the stale fringe left after a zoom-out/pan.                                                                                                                             |
| [svgReady](#getter-svgready)                                           | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | true once an off-screen (SVG) export can safely read this display's data: every visible region has loaded, or the fetch reached a terminal error / too-large state.                                                                                                                                |
| [svgReadyExtraTerminal](#getter-svgreadyextraterminal)                 | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Overridable hook (default false): a subclass returns true to mark an extra terminal state where off-screen export can proceed with no loaded data.                                                                                                                                                 |
| [layoutReady](#getter-layoutready)                                     | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Overridable hook (default false): whether a searchable feature layout currently exists.                                                                                                                                                                                                            |
| [renderBlocks](#getter-renderblocks)                                   | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Shared cached view for every LGV-based GPU display.                                                                                                                                                                                                                                                |
| [displayPhase](#getter-displayphase)                                   | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | The display's mutually-exclusive visual state, precedence single-sourced in `computeDisplayPhase`.                                                                                                                                                                                                 |
| [rpcPropsCacheKey](#getter-rpcpropscachekey)                           | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | The RPC cache key: the subclass's `rpcProps()` payload serialized to a string, so this getter's value is a primitive and MobX invalidates its observers only when the payload actually changed.                                                                                                    |
| [derivedRegionTooLargeEnabled](#getter-derivedregiontoolargeenabled)   | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Derived opt-in for the region-too-large gate: a display that declares a pre-flight byte estimate (`getByteEstimateConfig`) gates on it — the two are one decision, so they can't desync (this replaces the old dev-time "config set but gate off" console.error).                                  |
| [setLoadedRegion](#action-setloadedregion)                             | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Action wrapper so callers after async boundaries stay in MST strict mode.                                                                                                                                                                                                                          |
| [clearAllRpcData](#action-clearallrpcdata)                             | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | full reset: cancels fetch, clears error, loadedRegions, display-specific data, and the canvas-drawn flag.                                                                                                                                                                                          |
| [invalidateLoadedRegions](#action-invalidateloadedregions)             | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | lighter reset: cancels fetch and clears loadedRegions, leaving error and regionTooLarge intact                                                                                                                                                                                                     |
| [isCacheValid](#action-iscachevalid)                                   | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Overridable hook: return `false` to force re-fetch at the current zoom (wiggle uses this for zoom-level changes).                                                                                                                                                                                  |
| [getByteEstimateConfig](#action-getbyteestimateconfig)                 | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Overridable hook: return config to enable byte-estimate gating before fetch.                                                                                                                                                                                                                       |
| [onRegionTooLarge](#action-onregiontoolarge)                           | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Overridable hook (no-op base): called when `regionTooLarge` transitions to true.                                                                                                                                                                                                                   |
| [fetchRegions](#action-fetchregions)                                   | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Run a per-region fetch with byte-estimate gating.                                                                                                                                                                                                                                                  |
| [afterAttach](#action-afterattach)                                     | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | installs the five fetch-lifecycle autoruns (DisplayedRegionsChange, FetchVisibleRegions, SettingsInvalidate, ClearBlockingStateOnViewportChange, ClearHoverOnRegionTooLarge)                                                                                                                       |
| [userByteLimit](#volatile-userbytelimit)                               | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)         | user-confirmed byte limit after a force-load, disabling the gate.                                                                                                                                                                                                                                  |
| [byteEstimate](#volatile-byteestimate)                                 | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)         | Last byte estimate reported for this display, with the adapter's own `fetchSizeLimit` and `alwaysRender` flag.                                                                                                                                                                                     |
| [measuredSpanBp](#volatile-measuredspanbp)                             | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)         | The span the current `byteEstimate` was measured over, so the derived gate can rescale it to the span on screen now.                                                                                                                                                                               |
| [configuredFetchSizeLimit](#getter-configuredfetchsizelimit)           | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | The composing display's configured `fetchSizeLimit`, read straight from its config.                                                                                                                                                                                                                |
| [densityTooLargeForDerivedGate](#getter-densitytoolargeforderivedgate) | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | Extra (non-byte) too-large axis folded into the derived verdict — canvas overrides it with its feature-density gate.                                                                                                                                                                               |
| [configForceLoad](#getter-configforceload)                             | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | Declarative force-load: when true the display always renders regardless of region size / feature density (the config-driven equivalent of the force-load button).                                                                                                                                  |
| [estimatedBytesForVisibleSpan](#getter-estimatedbytesforvisiblespan)   | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | How many bytes we estimate a fetch of the span on screen right now would pull, obtained by rescaling the stored estimate from the span it was measured over (`measuredSpanBp`).                                                                                                                    |
| [tooLargeStatus](#getter-toolargestatus)                               | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | Shared derived verdict + reason (AUTO_FORCE_LOAD_BP floor, then bytes-over-limit, then the density axis), fed the scaled estimate so the byte gate self-releases on zoom-in.                                                                                                                       |
| [regionTooLarge](#getter-regiontoolarge)                               | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | The verdict the whole mixin exists to produce: true when the estimated download for the span on screen exceeds the resolved byte budget, or when the display's own density axis trips.                                                                                                             |
| [regionTooLargeReason](#getter-regiontoolargereason)                   | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | Which axis tripped, as banner text: the estimated download size, or "Too many features".                                                                                                                                                                                                           |
| [regionCannotBeRenderedText](#method-regioncannotberenderedtext)       | Methods    | [RegionTooLargeMixin](../regiontoolargemixin)         | Plaintext reason (for SVG export); the on-screen too-large UI is rendered by the display chrome via `TooLargeMessage`, not the model.                                                                                                                                                              |
| [setByteEstimate](#action-setbyteestimate)                             | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)         | Commits the byte estimate and records the span it covers (`measuredSpanBp`) so the derived gate can rescale it to the span on screen.                                                                                                                                                              |
| [raiseForceLoadLimits](#action-raiseforceloadlimits)                   | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)         | force-load: raise the byte limit past the current request so the gate releases.                                                                                                                                                                                                                    |
| [forceLoad](#action-forceload)                                         | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)         | Raises the byte limit past the current estimate and triggers a reload.                                                                                                                                                                                                                             |
| [canvasDrawn](#volatile-canvasdrawn)                                   | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | flips true on first paint; read by test selectors to detect render                                                                                                                                                                                                                                 |
| [currentRenderingBackend](#volatile-currentrenderingbackend)           | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | current backend reference, updated on context-loss recovery.                                                                                                                                                                                                                                       |
| [renderTick](#volatile-rendertick)                                     | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | counter the render autorun observes; bumped to force a re-render                                                                                                                                                                                                                                   |
| [autorunsInstalled](#volatile-autorunsinstalled)                       | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | guards attachRenderingBackend so the autorun pair spawns once per instance                                                                                                                                                                                                                         |
| [renderError](#volatile-rendererror)                                   | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | the render-backend (GPU/Canvas2D init or context-loss) error, or undefined.                                                                                                                                                                                                                        |
| [markCanvasDrawn](#action-markcanvasdrawn)                             | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       |                                                                                                                                                                                                                                                                                                    |
| [resetCanvasDrawn](#action-resetcanvasdrawn)                           | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       |                                                                                                                                                                                                                                                                                                    |
| [stopRenderingBackend](#action-stoprenderingbackend)                   | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       |                                                                                                                                                                                                                                                                                                    |
| [renderNow](#action-rendernow)                                         | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       |                                                                                                                                                                                                                                                                                                    |
| [setRenderError](#action-setrendererror)                               | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       | set/clear the render-backend error.                                                                                                                                                                                                                                                                |
| [attachRenderingBackend](#action-attachrenderingbackend)               | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       | attach a GPU/Canvas2D backend and install the upload + render autorun pair (idempotent — re-calling only swaps the backend)                                                                                                                                                                        |
| [activeStopToken](#volatile-activestoptoken)                           | Volatiles  | [FetchMixin](../fetchmixin)                           | stop token of the in-flight fetch, or undefined when idle                                                                                                                                                                                                                                          |
| [fetchGeneration](#volatile-fetchgeneration)                           | Volatiles  | [FetchMixin](../fetchmixin)                           | bumps at every fetch end; autoruns read it to re-evaluate, and it doubles as the staleness epoch inside runFetch                                                                                                                                                                                   |
| [fetchCanceled](#volatile-fetchcanceled)                               | Volatiles  | [FetchMixin](../fetchmixin)                           | true after the user explicitly cancels a load (the loading overlay's cancel button → `cancelFetchByUser`).                                                                                                                                                                                         |
| [regionStatuses](#volatile-regionstatuses)                             | Volatiles  | [FetchMixin](../fetchmixin)                           | latest status of each concurrent in-flight operation, keyed by an arbitrary id (the canvas display uses displayedRegionIndex).                                                                                                                                                                     |
| [lastStatusMs](#volatile-laststatusms)                                 | Volatiles  | [FetchMixin](../fetchmixin)                           | Date.now() of the last applied status write; the status callbacks gate on it to throttle a high-frequency progress stream.                                                                                                                                                                         |
| [isLoading](#getter-isloading)                                         | Getters    | [FetchMixin](../fetchmixin)                           | true while a fetch is active                                                                                                                                                                                                                                                                       |
| [makeStatusCallback](#method-makestatuscallback)                       | Methods    | [FetchMixin](../fetchmixin)                           | An RPC `statusCallback` bound to this display: forwards progress to the shared `statusMessage`, guarded by `isAlive` so a callback that fires after the node is torn down (RPCs resolve their status stream asynchronously) is a safe no-op.                                                       |
| [makeRegionStatusCallback](#method-makeregionstatuscallback)           | Methods    | [FetchMixin](../fetchmixin)                           | Per-region variant of `makeStatusCallback`: routes progress through `setRegionStatus(key, …)` so N concurrent per-region fetches aggregate into one status bar instead of clobbering each other.                                                                                                   |
| [throttleStatus](#action-throttlestatus)                               | Actions    | [FetchMixin](../fetchmixin)                           | Run `apply` only if at least `STATUS_THROTTLE_MS` has passed since the last status write.                                                                                                                                                                                                          |
| [resetStatus](#action-resetstatus)                                     | Actions    | [FetchMixin](../fetchmixin)                           | Drop the active stop token and clear all status bookkeeping.                                                                                                                                                                                                                                       |
| [stopActiveFetch](#action-stopactivefetch)                             | Actions    | [FetchMixin](../fetchmixin)                           | Abort the in-flight fetch (if any) and clear its status.                                                                                                                                                                                                                                           |
| [setRegionStatus](#action-setregionstatus)                             | Actions    | [FetchMixin](../fetchmixin)                           | Record one concurrent operation's latest status (keyed) and recompute the shared statusMessage/statusProgress as the aggregate across all in-flight keys.                                                                                                                                          |
| [cancelFetch](#action-cancelfetch)                                     | Actions    | [FetchMixin](../fetchmixin)                           | cancel any in-flight fetch and bump fetchGeneration (always bumps, so callers can retrigger fetch autoruns even when nothing was in flight).                                                                                                                                                       |
| [cancelFetchByUser](#action-cancelfetchbyuser)                         | Actions    | [FetchMixin](../fetchmixin)                           | User-initiated cancel from the loading overlay.                                                                                                                                                                                                                                                    |
| [beforeDestroy](#action-beforedestroy)                                 | Actions    | [FetchMixin](../fetchmixin)                           | Release an in-flight fetch's stop token on teardown.                                                                                                                                                                                                                                               |
| [runFetch](#action-runfetch)                                           | Actions    | [FetchMixin](../fetchmixin)                           | Run a cancel-safe fetch (cancels any prior).                                                                                                                                                                                                                                                       |
| [resolution](#property-resolution)                                     | Properties | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                    |
| [displayCrossHatches](#property-displaycrosshatches)                   | Properties | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                    |
| [loadedBpPerPx](#volatile-loadedbpperpx)                               | Volatiles  | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                    |
| [scalebarOverlapLeft](#getter-scalebaroverlapleft)                     | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                    |
| [posColor](#getter-poscolor)                                           | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                    |
| [negColor](#getter-negcolor)                                           | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                    |
| [bicolorPivot](#getter-bicolorpivot)                                   | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                    |
| [scaleType](#getter-scaletype)                                         | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                    |
| [autoscaleType](#getter-autoscaletype)                                 | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                    |
| [numStdDev](#getter-numstddev)                                         | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                    |
| [numQuantile](#getter-numquantile)                                     | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                    |
| [scatterPointSize](#getter-scatterpointsize)                           | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                    |
| [lineWidth](#getter-linewidth)                                         | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                    |
| [summaryScoreMode](#getter-summaryscoremode)                           | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                    |
| [renderingType](#getter-renderingtype)                                 | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                    |
| [minScore](#getter-minscore)                                           | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                    |
| [maxScore](#getter-maxscore)                                           | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                    |
| [minScoreBound](#getter-minscorebound)                                 | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                    |
| [maxScoreBound](#getter-maxscorebound)                                 | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                    |
| [hasResolution](#getter-hasresolution)                                 | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                    |
| [toggleCrossHatches](#action-togglecrosshatches)                       | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                    |
| [setResolution](#action-setresolution)                                 | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                    |
| [setLoadedBpPerPx](#action-setloadedbpperpx)                           | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                    |
| [setScaleType](#action-setscaletype)                                   | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                    |
| [setBicolorPivot](#action-setbicolorpivot)                             | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                    |
| [setMinScore](#action-setminscore)                                     | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                    |
| [setMaxScore](#action-setmaxscore)                                     | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                    |
| [setRenderingType](#action-setrenderingtype)                           | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                    |
| [setSummaryScoreMode](#action-setsummaryscoremode)                     | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                    |
| [setScatterPointSize](#action-setscatterpointsize)                     | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                    |
| [setLineWidth](#action-setlinewidth)                                   | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                    |
| [setAutoscale](#action-setautoscale)                                   | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin)   |                                                                                                                                                                                                                                                                                                    |
| [displayTypeDefaultChanges](#method-displaytypedefaultchanges)         | Methods    | [PromotableDefaultsMixin](../promotabledefaultsmixin) | Effective config differences a track following the default inherits from session-wide defaults (distinct from per-track config edits / trackConfigDeltas).                                                                                                                                         |
| [clearDisplayTypeDefaults](#action-cleardisplaytypedefaults)           | Actions    | [PromotableDefaultsMixin](../promotabledefaultsmixin) | Clear the session-wide defaults reported by `displayTypeDefaultChanges` so this display (and its siblings of the same type) revert to their config values.                                                                                                                                         |

### LinearManhattanDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/linearmanhattandisplay).

<details>
<summary>LinearManhattanDisplay - Properties</summary>

#### property: indexSnp

Index/lead SNP for LD coloring — a SNP id or `chr:bp` (1-based) string.
Auto-tracks the highest-scoring loaded SNP unless the user pins one (see
`indexSnpPinned`).

```ts
// type signature
type indexSnp = IMaybe<ISimpleType<string>>
// code
indexSnp: types.maybe(types.string)
```

#### property: indexSnpPinned

True once the user pins a specific index SNP (right-clicking a point). While
false, the index auto-tracks the top hit as data loads.

```ts
// type signature
type indexSnpPinned = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
indexSnpPinned: types.stripDefault(types.boolean, false)
```

</details>

<details>
<summary>LinearManhattanDisplay - Properties (other undocumented members)</summary>

| Member                                                 | Type                                                  |
| ------------------------------------------------------ | ----------------------------------------------------- |
| <span id="property-type">type</span>                   | `ISimpleType<"LinearManhattanDisplay">`               |
| <span id="property-configuration">configuration</span> | `IConfigurationReference<ConfigurationSchemaType<…>>` |

</details>

<details>
<summary>LinearManhattanDisplay - Volatiles</summary>

| Member                                                         | Type                                        |
| -------------------------------------------------------------- | ------------------------------------------- |
| <span id="volatile-rpcdatamap">rpcDataMap</span>               | `ObservableMap<number, ManhattanRpcResult>` |
| <span id="volatile-flatbushes">flatbushes</span>               | `ObservableMap<number, Flatbush>`           |
| <span id="volatile-featureundermouse">featureUnderMouse</span> | `ManhattanHit \| undefined`                 |
| <span id="volatile-showldlegend">showLdLegend</span>           | `true`                                      |

</details>

<details>
<summary>LinearManhattanDisplay - Getters</summary>

#### getter: view

the containing LGV, typed once here so downstream getters don't repeat the
`getContainingView` cast

```ts
type view = ModelInstanceTypeProps<_OverrideProps<_OverrideProps<…>, { ...; }>> & ... 21 more ... & IStateTreeNode<...>
```

#### getter: prefersOffset

Offset the track label above the plot so the -log10(p) y-axis stays pinned to
the content edge instead of dodging right of the label.

```ts
type prefersOffset = boolean
```

#### getter: color

resolved point color

```ts
type color = string
```

#### getter: colorBy

resolved coloring mode: 'normal' uses `color`, 'ld' colors by r² to the index
SNP

```ts
type colorBy = 'normal' | 'ld'
```

#### getter: ldAdapterConfig

the PLINK .ld sub-adapter configured on the track's `GWASAdapter`, or undefined
when none is set (the slot defaults to null, normalized here to undefined for
"absent")

```ts
type ldAdapterConfig = Record<string, unknown> | undefined
```

#### getter: hasLdData

LD coloring needs a configured .ld adapter; without one the colorBy='ld'
controls are inert, so they're hidden/disabled

```ts
type hasLdData = boolean
```

#### getter: ldColoringActive

LD coloring is actually in effect — the mode is on _and_ there's an .ld adapter
for it to read. `colorBy` alone can be 'ld' from config with no adapter
configured, in which case the worker silently falls back to normal coloring, so
every LD affordance (legend, missing-index warning) keys off this rather than
off `colorBy`.

```ts
type ldColoringActive = boolean
```

#### getter: domain

nice-rounded [min, max] -log10 p domain across loaded regions, or undefined
before any data loads

```ts
type domain = [number, number] | undefined
```

#### getter: ticks

y-axis tick positions. Manhattan plots are linear-only (pre-transformed -log10 p
values); the inherited scaleType config is intentionally ignored so the axis
ticks stay consistent with the linear `domain`.

```ts
type ticks = YScaleTicks | undefined
```

#### getter: renderState

render geometry for the inner canvas (between top/bottom YScaleBar label
offsets) — the area both the GPU renderer and findManhattanHit work in. Using
self.height directly would drift the hit-test off the rendered points.

```ts
type renderState = ManhattanRenderState
```

#### getter: regionRefNames

displayedRegionIndex → refName lookup. Hit-testing reads this on every
mousemove; MobX caches the view so visibleRegions changes invalidate it once
rather than rebuilding per event.

```ts
type regionRefNames = ReadonlyMap<number, string>
```

#### getter: topSnp

highest-scoring loaded SNP as a `chr:bp` (1-based) string — the default LD index
SNP. Derived from loaded data (not a fetch input), so it's applied via the
auto-pick autorun rather than read into rpcProps.

```ts
type topSnp = string | undefined
```

#### getter: indexSnpMissing

true when LD coloring is active with data loaded, but no region's LD data
referenced the index SNP — so every point is grey. LD is a single-region
analysis, so "found in no loaded region" means missing.

```ts
type indexSnpMissing = boolean
```

#### getter: indexSnpOffscreen

When the index SNP is a `chr:bp` locus, whether it lies outside every visible
region — the benign, pannable cause of `indexSnpMissing` (PLINK `--ld-window`
files carry no records once you pan away from the index), as opposed to
reference-name aliasing or the SNP being absent from the file. A bare rsID index
returns false since its position isn't known here.

```ts
type indexSnpOffscreen = boolean
```

</details>

<details>
<summary>LinearManhattanDisplay - Getters (other undocumented members)</summary>

| Member                                                                   | Type                                                                                                              |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| <span id="getter-displaymessagecomponent">DisplayMessageComponent</span> | `LazyExoticComponent<({ model, }: { model: ManhattanDisplayModel; }) => Element>`                                 |
| <span id="getter-tooltipcomponent">TooltipComponent</span>               | `({ model, clientMouseCoord, }: { model: TooltipModel; clientMouseCoord: [number, number]; }) => Element \| null` |

</details>

<details>
<summary>LinearManhattanDisplay - Methods</summary>

#### method: rpcProps

fetch inputs watched by SettingsInvalidate — any change (color, colorBy, index
SNP, LD adapter) triggers a refetch, since the worker bakes per-feature color
into the result

```ts
type rpcProps = () => {
  color: string
  colorBy: 'normal' | 'ld'
  indexSnp: string | undefined
  ldAdapterConfig: Record<string, unknown> | undefined
}
```

#### method: trackMenuItems

Manhattan track menu: shared Score submenu plus LD-coloring controls. Rendering
type / Resolution / Scale type don't apply to single-point rendering of
pre-transformed -log10 p values. Placed after the color/index actions so
referencing them doesn't make MST inference circular.

```ts
type trackMenuItems = () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | CustomMenuItem | { ...; })[]
```

#### method: contextMenuItems

right-click menu for a clicked point: feature details plus, when an LD adapter
is configured, a shortcut to recolor by LD to that SNP

```ts
type contextMenuItems = (hit: ManhattanHit) => MenuItem[]
```

</details>

<details>
<summary>LinearManhattanDisplay - Actions</summary>

#### action: selectFeature

open the feature details widget for a clicked point

```ts
type selectFeature = (hit: ManhattanHit) => void
```

#### action: colorByLdToHit

right-click "Color by LD to this SNP": switch into LD mode and pin the index on
the clicked point, so the auto-pick stops tracking the top hit. Keyed by chr:bp
(1-based) to match the worker's posKey. All mutations happen in one action so
rpcProps settles once and only a single recolor fetch fires.

```ts
type colorByLdToHit = (hit: ManhattanHit) => void
```

#### action: useTopHitAsIndex

release a pinned index back to auto-tracking, seeded at the current top hit (the
auto-pick autorun then keeps it on the top hit as data loads)

```ts
type useTopHitAsIndex = () => void
```

#### action: fetchNeeded

Manhattan features are 1:1 with the underlying SNPs (pre-transformed -log10 p
values) and don't downsample by zoom, so we never need to refetch on bpPerPx
change. We intentionally don't call setLoadedBpPerPx — the inherited
isCacheValid short-circuits to true whenever loadedBpPerPx is undefined, which
is exactly the behavior we want here.

```ts
type fetchNeeded = (
  needed: { region: Region; displayedRegionIndex: number }[],
) => Promise<void> | undefined
```

#### action: startRenderingBackend

identity encode — RPC result is the upload payload

```ts
type startRenderingBackend = (backend: ManhattanRenderingBackend) => void
```

</details>

<details>
<summary>LinearManhattanDisplay - Actions (other undocumented members)</summary>

| Member                                                                     | Type                                                                                                                                                         |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| <span id="action-setrpcdata">setRpcData</span>                             | `(idx: number, data: ManhattanRpcResult) => void`                                                                                                            |
| <span id="action-setfeatureundermouse">setFeatureUnderMouse</span>         | `(hit: ManhattanHit \| undefined) => void`                                                                                                                   |
| <span id="action-setshowldlegend">setShowLdLegend</span>                   | `(val: boolean) => void`                                                                                                                                     |
| <span id="action-setcolorby">setColorBy</span>                             | `(mode: "normal" \| "ld") => void`                                                                                                                           |
| <span id="action-setindexsnp">setIndexSnp</span>                           | `(snp?: string \| undefined) => void`                                                                                                                        |
| <span id="action-cleardisplayspecificdata">clearDisplaySpecificData</span> | `() => void`                                                                                                                                                 |
| <span id="action-rendersvg">renderSvg</span>                               | `(opts?: ExportSvgDisplayOptions \| undefined) => Promise<ReactElement<unknown, string \| JSXElementConstructor<any>> \| Iterable<...> \| AwaitedReactNode>` |

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

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
| <span id="getter-adapterconfig">adapterConfig</span>           | `any`                                                                                           |

**Methods**

#### method: renderingProps

props passed to the renderer's React "Rendering" component. these are
client-side only and never sent to the worker. includes displayModel and
callbacks

```ts
type renderingProps = () => { displayModel: ModelInstanceTypeProps<…> & { ...; } & { ...; } & { ...; } & IStateTreeNode<...>; }
```

| Member                                                                 | Type         |
| ---------------------------------------------------------------------- | ------------ |
| <span id="method-regioncannotberendered">regionCannotBeRendered</span> | `() => null` |

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

The RPC cache key: the subclass's `rpcProps()` payload serialized to a string,
so this getter's value is a primitive and MobX invalidates its observers only
when the payload actually changed. Building the payload touches far more
observables than it returns — canvas builds it from a whole config snapshot
(`resolvePromotableConfigSnapshot`), which reads every slot on the display
config — so an observer of the raw call would refetch on purely main-thread
settings (showLabels, heightMode, a compact/normal displayMode flip) that the
payload deliberately excludes. A fresh object would also never compare equal.
`''` for a display with no `rpcProps` (the SettingsInvalidate autorun isn't
installed there).

```ts
type rpcPropsCacheKey = string
```

#### getter: derivedRegionTooLargeEnabled

Derived opt-in for the region-too-large gate: a display that declares a
pre-flight byte estimate (`getByteEstimateConfig`) gates on it — the two are one
decision, so they can't desync (this replaces the old dev-time "config set but
gate off" console.error). Displays that capture the estimate through a custom
fetch (LD, arc) or fold the byte check into their feature RPC (canvas) leave
`getByteEstimateConfig` null and flip this true themselves.

Guarded on `view.initialized`: `getByteEstimateConfig` reads `visibleBp` (which
throws pre-init), and this getter is read from menu code before first paint.
Pre-init the banner never shows anyway, so `false` is right.

```ts
type derivedRegionTooLargeEnabled = boolean
```

**Actions**

#### action: setLoadedRegion

Action wrapper so callers after async boundaries stay in MST strict mode.

```ts
type setLoadedRegion = (displayedRegionIndex: number, region: Region) => void
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

#### volatile: userByteLimit

user-confirmed byte limit after a force-load, disabling the gate. Volatile, not
persisted: the interactive force-load button is a transient "show me this now"
action and must not leak a raised gate into a saved or shared session. The
declarative, session-scoped escape hatch is instead the `forceLoad` config slot
(set per-session via a session spec, or baked into a track config for
embedded/notebook views).

```ts
// type signature
type userByteLimit = number | undefined
// code
userByteLimit: undefined as number | undefined
```

#### volatile: byteEstimate

Last byte estimate reported for this display, with the adapter's own
`fetchSizeLimit` and `alwaysRender` flag. Its `bytes` covers `measuredSpanBp`,
not the span on screen now. Survives `clearAllRpcData` so an ordinary viewport
change doesn't flicker the banner; only chromosome navigation drops it.

```ts
// type signature
type byteEstimate = RegionByteEstimate | undefined
// code
byteEstimate: undefined as RegionByteEstimate | undefined
```

#### volatile: measuredSpanBp

The span the current `byteEstimate` was measured over, so the derived gate can
rescale it to the span on screen now. Written by `setByteEstimate`; ignored
unless `derivedRegionTooLargeEnabled`.

```ts
// type signature
type measuredSpanBp = number | undefined
// code
measuredSpanBp: undefined as number | undefined
```

**Getters**

#### getter: configuredFetchSizeLimit

The composing display's configured `fetchSizeLimit`, read straight from its
config. Only evaluated when the derived gate is enabled (guarded by
`derivedRegionTooLargeEnabled`), and every derived display extends
`baseLinearDisplayConfigSchema`, which owns the slot — so the read is always
valid where it fires. A display with a bespoke source can still override it.

```ts
type configuredFetchSizeLimit = number
```

#### getter: densityTooLargeForDerivedGate

Extra (non-byte) too-large axis folded into the derived verdict — canvas
overrides it with its feature-density gate. Byte-only derived displays leave it
false.

```ts
type densityTooLargeForDerivedGate = boolean
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

#### getter: estimatedBytesForVisibleSpan

How many bytes we estimate a fetch of the span on screen right now would pull,
obtained by rescaling the stored estimate from the span it was measured over
(`measuredSpanBp`). Rescaling is what makes the derived verdict a pure function
of the current view and lets it self-release on zoom-in — without it a large
zoomed-out estimate stays above the limit forever and gates refetch. Only
meaningful when `derivedRegionTooLargeEnabled`.

```ts
type estimatedBytesForVisibleSpan = number | undefined
```

#### getter: tooLargeStatus

Shared derived verdict + reason (AUTO_FORCE_LOAD_BP floor, then
bytes-over-limit, then the density axis), fed the scaled estimate so the byte
gate self-releases on zoom-in. Same helper as every other gating path so the
banner text can't drift.

```ts
type tooLargeStatus = RegionTooLargeStatus
```

#### getter: regionTooLarge

The verdict the whole mixin exists to produce: true when the estimated download
for the span on screen exceeds the resolved byte budget, or when the display's
own density axis trips. Derived, so it releases itself on zoom-in. Always false
for a display that hasn't opted in via `derivedRegionTooLargeEnabled`. The fetch
autoruns hold off while it is true, and `DisplayChrome` renders the banner from
it.

```ts
type regionTooLarge = boolean
```

#### getter: regionTooLargeReason

Which axis tripped, as banner text: the estimated download size, or "Too many
features". Empty string when the region isn't too large.

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

#### action: setByteEstimate

Commits the byte estimate and records the span it covers (`measuredSpanBp`) so
the derived gate can rescale it to the span on screen. Harmless for non-gated
displays (they ignore it).

```ts
type setByteEstimate = (estimate?: RegionByteEstimate | undefined) => void
```

#### action: raiseForceLoadLimits

force-load: raise the byte limit past the current request so the gate releases.
Prefers the estimate for the span on screen now, so it clears even if the view
zoomed out since the measurement; a display with the derived gate off has no
such estimate and falls back to the measured-span number. Canvas (which also has
a density force-load) overrides this entirely.

```ts
type raiseForceLoadLimits = (estimate?: RegionByteEstimate | undefined) => void
```

#### action: forceLoad

Raises the byte limit past the current estimate and triggers a reload. The
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

| Member                                                           | Type                  |
| ---------------------------------------------------------------- | --------------------- |
| <span id="getter-scalebaroverlapleft">scalebarOverlapLeft</span> | `number`              |
| <span id="getter-poscolor">posColor</span>                       | `string`              |
| <span id="getter-negcolor">negColor</span>                       | `string`              |
| <span id="getter-bicolorpivot">bicolorPivot</span>               | `number`              |
| <span id="getter-scaletype">scaleType</span>                     | `string`              |
| <span id="getter-autoscaletype">autoscaleType</span>             | `string`              |
| <span id="getter-numstddev">numStdDev</span>                     | `number`              |
| <span id="getter-numquantile">numQuantile</span>                 | `number`              |
| <span id="getter-scatterpointsize">scatterPointSize</span>       | `number`              |
| <span id="getter-linewidth">lineWidth</span>                     | `number`              |
| <span id="getter-summaryscoremode">summaryScoreMode</span>       | `string`              |
| <span id="getter-renderingtype">renderingType</span>             | `string`              |
| <span id="getter-minscore">minScore</span>                       | `number`              |
| <span id="getter-maxscore">maxScore</span>                       | `number`              |
| <span id="getter-minscorebound">minScoreBound</span>             | `number \| undefined` |
| <span id="getter-maxscorebound">maxScoreBound</span>             | `number \| undefined` |
| <span id="getter-hasresolution">hasResolution</span>             | `boolean`             |

**Actions**

| Member                                                           | Type                                     |
| ---------------------------------------------------------------- | ---------------------------------------- |
| <span id="action-togglecrosshatches">toggleCrossHatches</span>   | `() => void`                             |
| <span id="action-setresolution">setResolution</span>             | `(res: number) => void`                  |
| <span id="action-setloadedbpperpx">setLoadedBpPerPx</span>       | `(bpPerPx: number \| undefined) => void` |
| <span id="action-setscaletype">setScaleType</span>               | `(scaleType: string) => void`            |
| <span id="action-setbicolorpivot">setBicolorPivot</span>         | `(val?: number \| undefined) => void`    |
| <span id="action-setminscore">setMinScore</span>                 | `(val?: number \| undefined) => void`    |
| <span id="action-setmaxscore">setMaxScore</span>                 | `(val?: number \| undefined) => void`    |
| <span id="action-setrenderingtype">setRenderingType</span>       | `(type: string) => void`                 |
| <span id="action-setsummaryscoremode">setSummaryScoreMode</span> | `(val: string) => void`                  |
| <span id="action-setscatterpointsize">setScatterPointSize</span> | `(val?: number \| undefined) => void`    |
| <span id="action-setlinewidth">setLineWidth</span>               | `(val?: number \| undefined) => void`    |
| <span id="action-setautoscale">setAutoscale</span>               | `(val?: string \| undefined) => void`    |

</details>

<details>
<summary>Derived from PromotableDefaultsMixin</summary>

[PromotableDefaultsMixin →](../promotabledefaultsmixin)

**Methods**

#### method: displayTypeDefaultChanges

Effective config differences a track following the default inherits from
session-wide defaults (distinct from per-track config edits /
trackConfigDeltas). Drives the "affected by a session default" badge.

```ts
type displayTypeDefaultChanges = () => TrackConfigChange[]
```

**Actions**

#### action: clearDisplayTypeDefaults

Clear the session-wide defaults reported by `displayTypeDefaultChanges` so this
display (and its siblings of the same type) revert to their config values. Backs
the "clear default" action on the selector badge.

```ts
type clearDisplayTypeDefaults = () => void
```

</details>
