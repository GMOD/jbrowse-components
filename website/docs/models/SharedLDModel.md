---
id: sharedldmodel
title: SharedLDModel
sidebar_label: Display -> SharedLDModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`variants` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LDDisplay/shared.ts).

## Overview

Shared state model for LD displays

## Members

| Member                                                                 | Kind       | Defined by                                                | Description                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------- | ---------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [configuration](#property-configuration)                               | Properties | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [rpcData](#volatile-rpcdata)                                           | Volatiles  | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [focalSnpLocus](#volatile-focalsnplocus)                               | Volatiles  | SharedLDModel                                             | Locus (`refName:start`) of the focal SNP whose LD row+column is emphasized, or undefined.                                                                                                                                                    |
| [derivedRegionTooLargeEnabled](#getter-derivedregiontoolargeenabled)   | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [prefersOffset](#getter-prefersoffset)                                 | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [minorAlleleFrequencyFilter](#getter-minorallelefrequencyfilter)       | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [lengthCutoffFilter](#getter-lengthcutofffilter)                       | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [lineZoneHeight](#getter-linezoneheight)                               | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [ldMetric](#getter-ldmetric)                                           | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [showLegend](#getter-showlegend)                                       | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [showLDTriangle](#getter-showldtriangle)                               | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [showRecombination](#getter-showrecombination)                         | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [recombinationZoneHeight](#getter-recombinationzoneheight)             | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [fitToHeight](#getter-fittoheight)                                     | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [hweFilterThreshold](#getter-hwefilterthreshold)                       | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [callRateFilter](#getter-callratefilter)                               | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [showVerticalGuides](#getter-showverticalguides)                       | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [showLabels](#getter-showlabels)                                       | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [tickHeight](#getter-tickheight)                                       | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [useGenomicPositions](#getter-usegenomicpositions)                     | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [signedLD](#getter-signedld)                                           | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [jexlFilters](#getter-jexlfilters)                                     | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [snps](#getter-snps)                                                   | Getters    | SharedLDModel                                             | Returns true if this display uses pre-computed LD data (PLINK, ldmat) rather than computing LD from VCF genotypes                                                                                                                            |
| [cellWidth](#getter-cellwidth)                                         | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [filterStats](#getter-filterstats)                                     | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [recombination](#getter-recombination)                                 | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [dataLoaded](#getter-dataloaded)                                       | Getters    | SharedLDModel                                             | Global-display data-loaded signal read by `GlobalDataDisplayMixin.svgReady` (analog of `viewportWithinLoadedData`).                                                                                                                          |
| [rendersCanvas](#getter-renderscanvas)                                 | Getters    | SharedLDModel                                             | Override of the `GlobalDataDisplayMixin` hook that gates the initial pre-first-paint loading scrim (`rendersCanvas && !canvasDrawn`).                                                                                                        |
| [isPrecomputedLD](#getter-isprecomputedld)                             | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [effectiveLdMetric](#getter-effectiveldmetric)                         | Getters    | SharedLDModel                                             | Metric the loaded data actually represents.                                                                                                                                                                                                  |
| [dprimeAvailable](#getter-dprimeavailable)                             | Getters    | SharedLDModel                                             | Whether the D' metric can be shown — false only for a pre-computed file lacking a DP column, which disables the D' option.                                                                                                                   |
| [ldMethod](#getter-ldmethod)                                           | Getters    | SharedLDModel                                             | How the loaded LD values were derived: 'phased' (exact haplotypic), 'composite' (Weir estimate from unphased genotypes), or 'precomputed' (read from a PLINK/ldmat file).                                                                    |
| [focalSnpIndex](#getter-focalsnpindex)                                 | Getters    | SharedLDModel                                             | Array index of the focal SNP in the current `snps`, or -1 if none is selected or the locus is no longer present after a re-fetch.                                                                                                            |
| [effectiveLineZoneHeight](#getter-effectivelinezoneheight)             | Getters    | SharedLDModel                                             | Pixel height of the SVG zone above the canvas (variant labels + lines, or recombination scale).                                                                                                                                              |
| [ldCanvasHeight](#getter-ldcanvasheight)                               | Getters    | SharedLDModel                                             | Effective height for the LD canvas (total height minus the zone the recombination overlay / variant lines occupy above the matrix).                                                                                                          |
| [yScalar](#getter-yscalar)                                             | Getters    | SharedLDModel                                             | Per-frame yScalar squash factor.                                                                                                                                                                                                             |
| [renderTransform](#getter-rendertransform)                             | Getters    | SharedLDModel                                             | Forward transform { scale, viewOffsetX } shared by GPU render, mouse hit-test, and the matrix→genomic-position SVG lines.                                                                                                                    |
| [renderState](#getter-renderstate)                                     | Getters    | SharedLDModel                                             | Per-frame render state for the GPU backend.                                                                                                                                                                                                  |
| [rpcProps](#method-rpcprops)                                           | Methods    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [hitTest](#method-hittest)                                             | Methods    | SharedLDModel                                             | Inverse of `renderTransform` for the LD matrix: takes mouse coords (canvas-relative) and returns the LD cell under the cursor, or undefined.                                                                                                 |
| [filterMenuItems](#method-filtermenuitems)                             | Methods    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [legendItems](#method-legenditems)                                     | Methods    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [svgLegendWidth](#method-svglegendwidth)                               | Methods    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [trackMenuItems](#method-trackmenuitems)                               | Methods    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [renderSvg](#method-rendersvg)                                         | Methods    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [setRpcData](#action-setrpcdata)                                       | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [setFocalSnp](#action-setfocalsnp)                                     | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [setLineZoneHeight](#action-setlinezoneheight)                         | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [setMafFilter](#action-setmaffilter)                                   | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [setLDMetric](#action-setldmetric)                                     | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [setShowLegend](#action-setshowlegend)                                 | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [setShowLDTriangle](#action-setshowldtriangle)                         | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [setShowRecombination](#action-setshowrecombination)                   | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [setFitToHeight](#action-setfittoheight)                               | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [setHweFilter](#action-sethwefilter)                                   | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [setCallRateFilter](#action-setcallratefilter)                         | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [setShowVerticalGuides](#action-setshowverticalguides)                 | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [setShowLabels](#action-setshowlabels)                                 | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [setUseGenomicPositions](#action-setusegenomicpositions)               | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [setSignedLD](#action-setsignedld)                                     | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [setJexlFilters](#action-setjexlfilters)                               | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                              |
| [startRenderingBackend](#action-startrenderingbackend)                 | Actions    | SharedLDModel                                             | Starts the upload/render autorun.                                                                                                                                                                                                            |
| [performLDFetch](#action-performldfetch)                               | Actions    | SharedLDModel                                             | Re-fetches LD matrix for the current viewport.                                                                                                                                                                                               |
| [id](#property-id)                                                     | Properties | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                              |
| [type](#property-type)                                                 | Properties | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                              |
| [rpcDriverName](#property-rpcdrivername)                               | Properties | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                              |
| [ignorePromotedDefaults](#property-ignorepromoteddefaults)             | Properties | [BaseDisplay](../basedisplay)                             | true for a display that arrived inside a session received from someone else (a share link, an encoded/json session, a `spec-` URL).                                                                                                          |
| [error](#volatile-error)                                               | Volatiles  | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                              |
| [statusMessage](#volatile-statusmessage)                               | Volatiles  | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                              |
| [statusProgress](#volatile-statusprogress)                             | Volatiles  | [BaseDisplay](../basedisplay)                             | determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate.                                                                                                                          |
| [parentTrack](#getter-parenttrack)                                     | Getters    | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                              |
| [parentDisplay](#getter-parentdisplay)                                 | Getters    | [BaseDisplay](../basedisplay)                             | Returns the parent display if this display is nested within another display (e.g., PileupDisplay inside LinearAlignmentsDisplay)                                                                                                             |
| [RenderingComponent](#getter-renderingcomponent)                       | Getters    | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                              |
| [DisplayBlurb](#getter-displayblurb)                                   | Getters    | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                              |
| [adapterConfig](#getter-adapterconfig)                                 | Getters    | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                              |
| [isMinimized](#getter-isminimized)                                     | Getters    | [BaseDisplay](../basedisplay)                             | Returns true if the parent track is minimized.                                                                                                                                                                                               |
| [effectiveRpcDriverName](#getter-effectiverpcdrivername)               | Getters    | [BaseDisplay](../basedisplay)                             | Returns the effective RPC driver name with hierarchical fallback: 1.                                                                                                                                                                         |
| [DisplayMessageComponent](#getter-displaymessagecomponent)             | Getters    | [BaseDisplay](../basedisplay)                             | if a display-level message should be displayed instead, make this return a react component                                                                                                                                                   |
| [renderingProps](#method-renderingprops)                               | Methods    | [BaseDisplay](../basedisplay)                             | props passed to the renderer's React "Rendering" component.                                                                                                                                                                                  |
| [regionCannotBeRendered](#method-regioncannotberendered)               | Methods    | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                              |
| [setIgnorePromotedDefaults](#action-setignorepromoteddefaults)         | Actions    | [BaseDisplay](../basedisplay)                             | see the `ignorePromotedDefaults` property                                                                                                                                                                                                    |
| [setStatusMessage](#action-setstatusmessage)                           | Actions    | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                              |
| [setError](#action-seterror)                                           | Actions    | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                              |
| [setRpcDriverName](#action-setrpcdrivername)                           | Actions    | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                              |
| [reload](#action-reload)                                               | Actions    | [BaseDisplay](../basedisplay)                             | base display reload does nothing, see specialized displays for details                                                                                                                                                                       |
| [scrollTop](#volatile-scrolltop)                                       | Volatiles  | [TrackHeightMixin](../trackheightmixin)                   |                                                                                                                                                                                                                                              |
| [height](#getter-height)                                               | Getters    | [TrackHeightMixin](../trackheightmixin)                   |                                                                                                                                                                                                                                              |
| [setScrollTop](#action-setscrolltop)                                   | Actions    | [TrackHeightMixin](../trackheightmixin)                   |                                                                                                                                                                                                                                              |
| [setHeight](#action-setheight)                                         | Actions    | [TrackHeightMixin](../trackheightmixin)                   |                                                                                                                                                                                                                                              |
| [resizeHeight](#action-resizeheight)                                   | Actions    | [TrackHeightMixin](../trackheightmixin)                   |                                                                                                                                                                                                                                              |
| [displayPhase](#getter-displayphase)                                   | Getters    | [GlobalDataDisplayMixin](../globaldatadisplaymixin)       | Same precedence as MultiRegionDisplayMixin (single-sourced in `computeDisplayPhase`).                                                                                                                                                        |
| [reloadCounter](#volatile-reloadcounter)                               | Volatiles  | [GlobalFetchMixin](../globalfetchmixin)                   | Bumped by `reload()` to retrigger a global display's fetch autorun.                                                                                                                                                                          |
| [svgReadyExtraTerminal](#getter-svgreadyextraterminal)                 | Getters    | [GlobalFetchMixin](../globalfetchmixin)                   | Overridable hook (default false): a subclass returns true to mark an extra terminal state where off-screen export can proceed with no loaded data (mirrors `MultiRegionDisplayMixin.svgReadyExtraTerminal`).                                 |
| [svgReady](#getter-svgready)                                           | Getters    | [GlobalFetchMixin](../globalfetchmixin)                   | Global-display analog of `MultiRegionDisplayMixin.svgReady`: true once an off-screen (SVG) export can read final data.                                                                                                                       |
| [userByteLimit](#volatile-userbytelimit)                               | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)             | user-confirmed byte limit after a force-load, disabling the gate.                                                                                                                                                                            |
| [byteEstimate](#volatile-byteestimate)                                 | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)             | Last byte estimate reported for this display, with the adapter's own `fetchSizeLimit` and `alwaysRender` flag.                                                                                                                               |
| [measuredSpanBp](#volatile-measuredspanbp)                             | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)             | The span the current `byteEstimate` was measured over, so the derived gate can rescale it to the span on screen now.                                                                                                                         |
| [configuredFetchSizeLimit](#getter-configuredfetchsizelimit)           | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)             | The composing display's configured `fetchSizeLimit`, read straight from its config.                                                                                                                                                          |
| [densityTooLargeForDerivedGate](#getter-densitytoolargeforderivedgate) | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)             | Extra (non-byte) too-large axis folded into the derived verdict — canvas overrides it with its feature-density gate.                                                                                                                         |
| [configForceLoad](#getter-configforceload)                             | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)             | Declarative force-load: when true the display always renders regardless of region size / feature density (the config-driven equivalent of the force-load button).                                                                            |
| [estimatedBytesForVisibleSpan](#getter-estimatedbytesforvisiblespan)   | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)             | How many bytes we estimate a fetch of the span on screen right now would pull, obtained by rescaling the stored estimate from the span it was measured over (`measuredSpanBp`).                                                              |
| [tooLargeStatus](#getter-toolargestatus)                               | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)             | Shared derived verdict + reason (AUTO_FORCE_LOAD_BP floor, then bytes-over-limit, then the density axis), fed the scaled estimate so the byte gate self-releases on zoom-in.                                                                 |
| [regionTooLarge](#getter-regiontoolarge)                               | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)             | The verdict the whole mixin exists to produce: true when the estimated download for the span on screen exceeds the resolved byte budget, or when the display's own density axis trips.                                                       |
| [regionTooLargeReason](#getter-regiontoolargereason)                   | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)             | Which axis tripped, as banner text: the estimated download size, or "Too many features".                                                                                                                                                     |
| [regionCannotBeRenderedText](#method-regioncannotberenderedtext)       | Methods    | [RegionTooLargeMixin](../regiontoolargemixin)             | Plaintext reason (for SVG export); the on-screen too-large UI is rendered by the display chrome via `TooLargeMessage`, not the model.                                                                                                        |
| [setByteEstimate](#action-setbyteestimate)                             | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)             | Commits the byte estimate and records the span it covers (`measuredSpanBp`) so the derived gate can rescale it to the span on screen.                                                                                                        |
| [raiseForceLoadLimits](#action-raiseforceloadlimits)                   | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)             | force-load: raise the byte limit past the current request so the gate releases.                                                                                                                                                              |
| [forceLoad](#action-forceload)                                         | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)             | Raises the byte limit past the current estimate and triggers a reload.                                                                                                                                                                       |
| [activeStopToken](#volatile-activestoptoken)                           | Volatiles  | [FetchMixin](../fetchmixin)                               | stop token of the in-flight fetch, or undefined when idle                                                                                                                                                                                    |
| [fetchGeneration](#volatile-fetchgeneration)                           | Volatiles  | [FetchMixin](../fetchmixin)                               | bumps at every fetch end; autoruns read it to re-evaluate, and it doubles as the staleness epoch inside runFetch                                                                                                                             |
| [fetchCanceled](#volatile-fetchcanceled)                               | Volatiles  | [FetchMixin](../fetchmixin)                               | true after the user explicitly cancels a load (the loading overlay's cancel button → `cancelFetchByUser`).                                                                                                                                   |
| [regionStatuses](#volatile-regionstatuses)                             | Volatiles  | [FetchMixin](../fetchmixin)                               | latest status of each concurrent in-flight operation, keyed by an arbitrary id (the canvas display uses displayedRegionIndex).                                                                                                               |
| [lastStatusMs](#volatile-laststatusms)                                 | Volatiles  | [FetchMixin](../fetchmixin)                               | Date.now() of the last applied status write; the status callbacks gate on it to throttle a high-frequency progress stream.                                                                                                                   |
| [isLoading](#getter-isloading)                                         | Getters    | [FetchMixin](../fetchmixin)                               | true while a fetch is active                                                                                                                                                                                                                 |
| [makeStatusCallback](#method-makestatuscallback)                       | Methods    | [FetchMixin](../fetchmixin)                               | An RPC `statusCallback` bound to this display: forwards progress to the shared `statusMessage`, guarded by `isAlive` so a callback that fires after the node is torn down (RPCs resolve their status stream asynchronously) is a safe no-op. |
| [makeRegionStatusCallback](#method-makeregionstatuscallback)           | Methods    | [FetchMixin](../fetchmixin)                               | Per-region variant of `makeStatusCallback`: routes progress through `setRegionStatus(key, …)` so N concurrent per-region fetches aggregate into one status bar instead of clobbering each other.                                             |
| [throttleStatus](#action-throttlestatus)                               | Actions    | [FetchMixin](../fetchmixin)                               | Run `apply` only if at least `STATUS_THROTTLE_MS` has passed since the last status write.                                                                                                                                                    |
| [resetStatus](#action-resetstatus)                                     | Actions    | [FetchMixin](../fetchmixin)                               | Drop the active stop token and clear all status bookkeeping.                                                                                                                                                                                 |
| [stopActiveFetch](#action-stopactivefetch)                             | Actions    | [FetchMixin](../fetchmixin)                               | Abort the in-flight fetch (if any) and clear its status.                                                                                                                                                                                     |
| [setRegionStatus](#action-setregionstatus)                             | Actions    | [FetchMixin](../fetchmixin)                               | Record one concurrent operation's latest status (keyed) and recompute the shared statusMessage/statusProgress as the aggregate across all in-flight keys.                                                                                    |
| [cancelFetch](#action-cancelfetch)                                     | Actions    | [FetchMixin](../fetchmixin)                               | cancel any in-flight fetch and bump fetchGeneration (always bumps, so callers can retrigger fetch autoruns even when nothing was in flight).                                                                                                 |
| [cancelFetchByUser](#action-cancelfetchbyuser)                         | Actions    | [FetchMixin](../fetchmixin)                               | User-initiated cancel from the loading overlay.                                                                                                                                                                                              |
| [beforeDestroy](#action-beforedestroy)                                 | Actions    | [FetchMixin](../fetchmixin)                               | Release an in-flight fetch's stop token on teardown.                                                                                                                                                                                         |
| [runFetch](#action-runfetch)                                           | Actions    | [FetchMixin](../fetchmixin)                               | Run a cancel-safe fetch (cancels any prior).                                                                                                                                                                                                 |
| [canvasDrawn](#volatile-canvasdrawn)                                   | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)           | flips true on first paint; read by test selectors to detect render                                                                                                                                                                           |
| [currentRenderingBackend](#volatile-currentrenderingbackend)           | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)           | current backend reference, updated on context-loss recovery.                                                                                                                                                                                 |
| [renderTick](#volatile-rendertick)                                     | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)           | counter the render autorun observes; bumped to force a re-render                                                                                                                                                                             |
| [autorunsInstalled](#volatile-autorunsinstalled)                       | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)           | guards attachRenderingBackend so the autorun pair spawns once per instance                                                                                                                                                                   |
| [renderError](#volatile-rendererror)                                   | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)           | the render-backend (GPU/Canvas2D init or context-loss) error, or undefined.                                                                                                                                                                  |
| [markCanvasDrawn](#action-markcanvasdrawn)                             | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)           |                                                                                                                                                                                                                                              |
| [resetCanvasDrawn](#action-resetcanvasdrawn)                           | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)           |                                                                                                                                                                                                                                              |
| [stopRenderingBackend](#action-stoprenderingbackend)                   | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)           |                                                                                                                                                                                                                                              |
| [renderNow](#action-rendernow)                                         | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)           |                                                                                                                                                                                                                                              |
| [setRenderError](#action-setrendererror)                               | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)           | set/clear the render-backend error.                                                                                                                                                                                                          |
| [attachRenderingBackend](#action-attachrenderingbackend)               | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)           | attach a GPU/Canvas2D backend and install the upload + render autorun pair (idempotent — re-calling only swaps the backend)                                                                                                                  |
| [lastDrawnOffsetPx](#volatile-lastdrawnoffsetpx)                       | Volatiles  | [StaleViewportRescaleMixin](../staleviewportrescalemixin) | offsetPx of the viewport when the canvas was last fully drawn                                                                                                                                                                                |
| [lastDrawnBpPerPx](#volatile-lastdrawnbpperpx)                         | Volatiles  | [StaleViewportRescaleMixin](../staleviewportrescalemixin) | bpPerPx of the viewport when the canvas was last fully drawn                                                                                                                                                                                 |
| [setLastDrawnViewport](#action-setlastdrawnviewport)                   | Actions    | [StaleViewportRescaleMixin](../staleviewportrescalemixin) |                                                                                                                                                                                                                                              |

<details>
<summary>SharedLDModel - Properties</summary>

| Member                                                 | Type                                                  |
| ------------------------------------------------------ | ----------------------------------------------------- |
| <span id="property-configuration">configuration</span> | `IConfigurationReference<ConfigurationSchemaType<…>>` |

</details>

<details>
<summary>SharedLDModel - Volatiles</summary>

#### volatile: focalSnpLocus

Locus (`refName:start`) of the focal SNP whose LD row+column is emphasized, or
undefined. Keyed by locus rather than array index so the selection survives a
re-fetch that reorders SNPs.

```ts
// type signature
type focalSnpLocus = string | undefined
// code
focalSnpLocus: undefined as string | undefined
```

</details>

<details>
<summary>SharedLDModel - Volatiles (other undocumented members)</summary>

| Member                                     | Type                   |
| ------------------------------------------ | ---------------------- |
| <span id="volatile-rpcdata">rpcData</span> | `LDDataResult \| null` |

</details>

<details>
<summary>SharedLDModel - Getters</summary>

#### getter: snps

Returns true if this display uses pre-computed LD data (PLINK, ldmat) rather
than computing LD from VCF genotypes

```ts
type snps = LDSnp[]
```

#### getter: dataLoaded

Global-display data-loaded signal read by `GlobalDataDisplayMixin.svgReady`
(analog of `viewportWithinLoadedData`). The fetch commits `rpcData` even for an
empty viewport, so this flips true once data has loaded AND that data was
fetched for the current viewport. Gating on freshness — not merely
`rpcData !== null` — keeps off-screen `svgReady` from resolving on data left
over from the pre-pan/zoom viewport during the debounced-refetch window
(`setLastDrawnViewport` runs right after `setRpcData`). Without the override the
mixin default (`false`) leaves `svgReady` unable to resolve on a successful
load, hanging SVG export.

```ts
type dataLoaded = boolean
```

#### getter: rendersCanvas

Override of the `GlobalDataDisplayMixin` hook that gates the initial
pre-first-paint loading scrim (`rendersCanvas && !canvasDrawn`). With the
triangle toggled off, `LDDisplayComponent` renders an EmptyState ("Enable LD
triangle…") instead of a canvas, so `canvasDrawn` never flips. Returning false
here keeps the scrim from sitting permanently over that placeholder. This is the
_only_ override of the hook — do not remove it as dead-looking single-use code:
without it the LD track shows a stuck loading spinner whenever the triangle is
disabled. If the EmptyState is ever moved outside `DisplayChrome`, revisit
together.

```ts
type rendersCanvas = boolean
```

#### getter: effectiveLdMetric

Metric the loaded data actually represents. A pre-computed file with no D'
column downgrades a 'dprime' request to 'r2', so the legend and the metric
radios read this rather than the raw requested `ldMetric`.

```ts
type effectiveLdMetric = LDMetric
```

#### getter: dprimeAvailable

Whether the D' metric can be shown — false only for a pre-computed file lacking
a DP column, which disables the D' option.

```ts
type dprimeAvailable = boolean
```

#### getter: ldMethod

How the loaded LD values were derived: 'phased' (exact haplotypic), 'composite'
(Weir estimate from unphased genotypes), or 'precomputed' (read from a
PLINK/ldmat file). Undefined until data loads.

```ts
type ldMethod = LDMethod | undefined
```

#### getter: focalSnpIndex

Array index of the focal SNP in the current `snps`, or -1 if none is selected or
the locus is no longer present after a re-fetch.

```ts
type focalSnpIndex = number
```

#### getter: effectiveLineZoneHeight

Pixel height of the SVG zone above the canvas (variant labels + lines, or
recombination scale). The hit-test subtracts this from mouseY before reversing
the render transform.

```ts
type effectiveLineZoneHeight = number
```

#### getter: ldCanvasHeight

Effective height for the LD canvas (total height minus the zone the
recombination overlay / variant lines occupy above the matrix).

```ts
type ldCanvasHeight = number
```

#### getter: yScalar

Per-frame yScalar squash factor. When fitToHeight is on, squashes the natural
(canvasWidth/2) triangle into ldCanvasHeight. Lives on the main thread so resize
doesn't trigger a worker re-fetch.

```ts
type yScalar = number
```

#### getter: renderTransform

Forward transform { scale, viewOffsetX } shared by GPU render, mouse hit-test,
and the matrix→genomic-position SVG lines. See `computeRenderTransform` for the
math.

```ts
type renderTransform = RenderTransform
```

#### getter: renderState

Per-frame render state for the GPU backend. Read by the upload/render autorun —
every change to any tracked observable (view.bpPerPx, view.offsetPx,
model.fitToHeight, rpcData contents, …) re-fires it.

```ts
type renderState =
  | {
      yScalar: number
      canvasWidth: number
      canvasHeight: number
      signedLD: boolean
      viewScale: number
      viewOffsetX: number
      uniformW: number
    }
  | undefined
```

</details>

<details>
<summary>SharedLDModel - Getters (other undocumented members)</summary>

| Member                                                                             | Type                                                                           |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| <span id="getter-derivedregiontoolargeenabled">derivedRegionTooLargeEnabled</span> | `boolean`                                                                      |
| <span id="getter-prefersoffset">prefersOffset</span>                               | `boolean`                                                                      |
| <span id="getter-minorallelefrequencyfilter">minorAlleleFrequencyFilter</span>     | `number`                                                                       |
| <span id="getter-lengthcutofffilter">lengthCutoffFilter</span>                     | `number`                                                                       |
| <span id="getter-linezoneheight">lineZoneHeight</span>                             | `number`                                                                       |
| <span id="getter-ldmetric">ldMetric</span>                                         | `"r2" \| "dprime"`                                                             |
| <span id="getter-showlegend">showLegend</span>                                     | `boolean`                                                                      |
| <span id="getter-showldtriangle">showLDTriangle</span>                             | `boolean`                                                                      |
| <span id="getter-showrecombination">showRecombination</span>                       | `boolean`                                                                      |
| <span id="getter-recombinationzoneheight">recombinationZoneHeight</span>           | `number`                                                                       |
| <span id="getter-fittoheight">fitToHeight</span>                                   | `boolean`                                                                      |
| <span id="getter-hwefilterthreshold">hweFilterThreshold</span>                     | `number`                                                                       |
| <span id="getter-callratefilter">callRateFilter</span>                             | `number`                                                                       |
| <span id="getter-showverticalguides">showVerticalGuides</span>                     | `boolean`                                                                      |
| <span id="getter-showlabels">showLabels</span>                                     | `boolean`                                                                      |
| <span id="getter-tickheight">tickHeight</span>                                     | `number`                                                                       |
| <span id="getter-usegenomicpositions">useGenomicPositions</span>                   | `boolean`                                                                      |
| <span id="getter-signedld">signedLD</span>                                         | `boolean`                                                                      |
| <span id="getter-jexlfilters">jexlFilters</span>                                   | `string[]`                                                                     |
| <span id="getter-cellwidth">cellWidth</span>                                       | `number`                                                                       |
| <span id="getter-filterstats">filterStats</span>                                   | `FilterStats \| undefined`                                                     |
| <span id="getter-recombination">recombination</span>                               | `{ values: Float32Array<ArrayBufferLike>; positions: number[]; } \| undefined` |
| <span id="getter-isprecomputedld">isPrecomputedLD</span>                           | `boolean`                                                                      |

</details>

<details>
<summary>SharedLDModel - Methods</summary>

#### method: hitTest

Inverse of `renderTransform` for the LD matrix: takes mouse coords
(canvas-relative) and returns the LD cell under the cursor, or undefined.
Mirrors plugins/hic's `hitTest` so both contact maps keep the forward and
inverse transforms paired on the model.

```ts
type hitTest = (mouseX: number, mouseY: number) => LDFlatbushItem | undefined
```

</details>

<details>
<summary>SharedLDModel - Methods (other undocumented members)</summary>

| Member                                                   | Type                                                                                                                                                                 |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="method-rpcprops">rpcProps</span>               | `() => {…}`                                                                                                                                                          |
| <span id="method-filtermenuitems">filterMenuItems</span> | `() => { label: string; onClick: () => void; }[]`                                                                                                                    |
| <span id="method-legenditems">legendItems</span>         | `() => LegendItem[]`                                                                                                                                                 |
| <span id="method-svglegendwidth">svgLegendWidth</span>   | `() => number`                                                                                                                                                       |
| <span id="method-trackmenuitems">trackMenuItems</span>   | `() => (MenuDivider \| MenuSubHeader \| NormalMenuItem \| CheckboxMenuItem \| RadioMenuItem \| SubMenuItem \| CustomMenuItem \| { ...; } \| { ...; } \| { ...; })[]` |
| <span id="method-rendersvg">renderSvg</span>             | `(opts: ExportSvgDisplayOptions) => Promise<ReactNode>`                                                                                                              |

</details>

<details>
<summary>SharedLDModel - Actions</summary>

#### action: startRenderingBackend

Starts the upload/render autorun. Data + color ramp both derive from the same
rpcData object, so a single identity-diffed slot handles both uploads.

```ts
type startRenderingBackend = (backend: LDRenderingBackend) => void
```

#### action: performLDFetch

Re-fetches LD matrix for the current viewport. Driven by the `afterAttach`
autorun; `reload()` reaches it by bumping `reloadCounter`, which that autorun
tracks.

```ts
type performLDFetch = () => Promise<void>
```

</details>

<details>
<summary>SharedLDModel - Actions (other undocumented members)</summary>

| Member                                                                 | Type                                       |
| ---------------------------------------------------------------------- | ------------------------------------------ |
| <span id="action-setrpcdata">setRpcData</span>                         | `(data: LDDataResult \| null) => void`     |
| <span id="action-setfocalsnp">setFocalSnp</span>                       | `(snp: LDSnp \| undefined) => void`        |
| <span id="action-setlinezoneheight">setLineZoneHeight</span>           | `(n: number) => void`                      |
| <span id="action-setmaffilter">setMafFilter</span>                     | `(arg: number) => void`                    |
| <span id="action-setldmetric">setLDMetric</span>                       | `(metric: LDMetric) => void`               |
| <span id="action-setshowlegend">setShowLegend</span>                   | `(show: boolean) => void`                  |
| <span id="action-setshowldtriangle">setShowLDTriangle</span>           | `(show: boolean) => void`                  |
| <span id="action-setshowrecombination">setShowRecombination</span>     | `(show: boolean) => void`                  |
| <span id="action-setfittoheight">setFitToHeight</span>                 | `(value: boolean) => void`                 |
| <span id="action-sethwefilter">setHweFilter</span>                     | `(threshold: number) => void`              |
| <span id="action-setcallratefilter">setCallRateFilter</span>           | `(threshold: number) => void`              |
| <span id="action-setshowverticalguides">setShowVerticalGuides</span>   | `(show: boolean) => void`                  |
| <span id="action-setshowlabels">setShowLabels</span>                   | `(show: boolean) => void`                  |
| <span id="action-setusegenomicpositions">setUseGenomicPositions</span> | `(value: boolean) => void`                 |
| <span id="action-setsignedld">setSignedLD</span>                       | `(value: boolean) => void`                 |
| <span id="action-setjexlfilters">setJexlFilters</span>                 | `(filters: string[] \| undefined) => void` |

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
| <span id="property-type">type</span>                   | `ISimpleType<string>`                              |
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

#### getter: DisplayMessageComponent

if a display-level message should be displayed instead, make this return a react
component

```ts
type DisplayMessageComponent = FC<any> | undefined
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
<summary>Derived from GlobalDataDisplayMixin</summary>

[GlobalDataDisplayMixin →](../globaldatadisplaymixin)

**Getters**

#### getter: displayPhase

Same precedence as MultiRegionDisplayMixin (single-sourced in
`computeDisplayPhase`). A global display has no per-region staleness axis, but
it does have a pre-first-paint window: between component mount and `isLoading`
flipping true (on HiC that means the `CoreGetInfo` round-trip its first fetch
waits on). Mirror MultiRegion's `!isReady` term with `!canvasDrawn` so the
loading scrim shows immediately on open instead of after that gap — gated by
`rendersCanvas` so a display showing a static non-canvas placeholder isn't stuck
under it. Once painted, `canvasDrawn` stays true through viewport/setting
changes (StaleViewportRescaleMixin keeps the last frame up during refetch), so
this adds no scrim on pan or zoom — those keep the existing `isLoading`
behavior. Reads `renderError` (RenderLifecycleMixin), which is why it lives
here, not in GlobalFetchMixin.

```ts
type displayPhase = DisplayPhase
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
<summary>Derived from StaleViewportRescaleMixin</summary>

[StaleViewportRescaleMixin →](../staleviewportrescalemixin)

**Volatiles**

#### volatile: lastDrawnOffsetPx

offsetPx of the viewport when the canvas was last fully drawn

```ts
// type signature
type lastDrawnOffsetPx = number | undefined
// code
lastDrawnOffsetPx: undefined as number | undefined
```

#### volatile: lastDrawnBpPerPx

bpPerPx of the viewport when the canvas was last fully drawn

```ts
// type signature
type lastDrawnBpPerPx = number | undefined
// code
lastDrawnBpPerPx: undefined as number | undefined
```

**Actions**

| Member                                                             | Type                                          |
| ------------------------------------------------------------------ | --------------------------------------------- |
| <span id="action-setlastdrawnviewport">setLastDrawnViewport</span> | `(offsetPx: number, bpPerPx: number) => void` |

</details>
