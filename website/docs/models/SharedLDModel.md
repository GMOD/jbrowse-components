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

| Member                                                               | Kind       | Defined by                                                | Description                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------- | ---------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [configuration](#property-configuration)                             | Properties | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [rpcData](#volatile-rpcdata)                                         | Volatiles  | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [focalSnpLocus](#volatile-focalsnplocus)                             | Volatiles  | SharedLDModel                                             | Locus (`refName:start`) of the focal SNP whose LD row+column is emphasized, or undefined.                                                                                                                                                                            |
| [prefersOffset](#getter-prefersoffset)                               | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [minorAlleleFrequencyFilter](#getter-minorallelefrequencyfilter)     | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [lengthCutoffFilter](#getter-lengthcutofffilter)                     | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [lineZoneHeight](#getter-linezoneheight)                             | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [ldMetric](#getter-ldmetric)                                         | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [showLegend](#getter-showlegend)                                     | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [showLDTriangle](#getter-showldtriangle)                             | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [showRecombination](#getter-showrecombination)                       | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [recombinationZoneHeight](#getter-recombinationzoneheight)           | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [fitToHeight](#getter-fittoheight)                                   | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [hweFilterThreshold](#getter-hwefilterthreshold)                     | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [callRateFilter](#getter-callratefilter)                             | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [showVerticalGuides](#getter-showverticalguides)                     | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [showLabels](#getter-showlabels)                                     | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [tickHeight](#getter-tickheight)                                     | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [useGenomicPositions](#getter-usegenomicpositions)                   | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [signedLD](#getter-signedld)                                         | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [jexlFilters](#getter-jexlfilters)                                   | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [snps](#getter-snps)                                                 | Getters    | SharedLDModel                                             | Returns true if this display uses pre-computed LD data (PLINK, ldmat) rather than computing LD from VCF genotypes                                                                                                                                                    |
| [cellWidth](#getter-cellwidth)                                       | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [filterStats](#getter-filterstats)                                   | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [recombination](#getter-recombination)                               | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [dataCurrent](#getter-datacurrent)                                   | Getters    | SharedLDModel                                             | The shared freshness hook, read by `GlobalFetchMixin.svgReady`.                                                                                                                                                                                                      |
| [rendersCanvas](#getter-renderscanvas)                               | Getters    | SharedLDModel                                             | Override of the `GlobalDataDisplayMixin` hook that gates the initial pre-first-paint loading scrim (`rendersCanvas && !canvasDrawn`).                                                                                                                                |
| [isPrecomputedLD](#getter-isprecomputedld)                           | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [effectiveLdMetric](#getter-effectiveldmetric)                       | Getters    | SharedLDModel                                             | Metric the loaded data actually represents.                                                                                                                                                                                                                          |
| [dprimeAvailable](#getter-dprimeavailable)                           | Getters    | SharedLDModel                                             | Whether the D' metric can be shown — false only for a pre-computed file lacking a DP column, which disables the D' option.                                                                                                                                           |
| [ldMethod](#getter-ldmethod)                                         | Getters    | SharedLDModel                                             | How the loaded LD values were derived: 'phased' (exact haplotypic), 'composite' (Weir estimate from unphased genotypes), or 'precomputed' (read from a PLINK/ldmat file).                                                                                            |
| [focalSnpIndex](#getter-focalsnpindex)                               | Getters    | SharedLDModel                                             | Array index of the focal SNP in the current `snps`, or -1 if none is selected or the locus is no longer present after a re-fetch.                                                                                                                                    |
| [byteGateEnabled](#getter-bytegateenabled)                           | Getters    | SharedLDModel                                             | Opt into RegionTooLargeMixin's derived byte gate (byte axis only, no density axis), except for pre-computed LD.                                                                                                                                                      |
| [effectiveLineZoneHeight](#getter-effectivelinezoneheight)           | Getters    | SharedLDModel                                             | Pixel height of the SVG zone above the canvas (variant labels + lines, or recombination scale).                                                                                                                                                                      |
| [ldCanvasHeight](#getter-ldcanvasheight)                             | Getters    | SharedLDModel                                             | Effective height for the LD canvas (total height minus the zone the recombination overlay / variant lines occupy above the matrix).                                                                                                                                  |
| [yScalar](#getter-yscalar)                                           | Getters    | SharedLDModel                                             | Per-frame yScalar squash factor.                                                                                                                                                                                                                                     |
| [renderTransform](#getter-rendertransform)                           | Getters    | SharedLDModel                                             | Forward transform { scale, viewOffsetX } shared by GPU render, mouse hit-test, and the matrix→genomic-position SVG lines.                                                                                                                                            |
| [renderState](#getter-renderstate)                                   | Getters    | SharedLDModel                                             | Per-frame render state for the GPU backend.                                                                                                                                                                                                                          |
| [connectorLineCoords](#getter-connectorlinecoords)                   | Getters    | SharedLDModel                                             | The connector lines tying each matrix column to its SNP's genomic position, in viewport pixels, plus the label the hover tooltip and `VariantLabels` show.                                                                                                           |
| [rpcProps](#method-rpcprops)                                         | Methods    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [hitTest](#method-hittest)                                           | Methods    | SharedLDModel                                             | Inverse of `renderTransform` for the LD matrix: takes mouse coords (canvas-relative) and returns the LD cell under the cursor, or undefined.                                                                                                                         |
| [filterMenuItems](#method-filtermenuitems)                           | Methods    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [legendItems](#method-legenditems)                                   | Methods    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [svgLegendWidth](#method-svglegendwidth)                             | Methods    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [trackMenuItems](#method-trackmenuitems)                             | Methods    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [renderSvg](#method-rendersvg)                                       | Methods    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [setRpcData](#action-setrpcdata)                                     | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [setFocalSnp](#action-setfocalsnp)                                   | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [setLineZoneHeight](#action-setlinezoneheight)                       | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [setMafFilter](#action-setmaffilter)                                 | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [setLDMetric](#action-setldmetric)                                   | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [setShowLegend](#action-setshowlegend)                               | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [setShowLDTriangle](#action-setshowldtriangle)                       | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [setShowRecombination](#action-setshowrecombination)                 | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [setFitToHeight](#action-setfittoheight)                             | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [setHweFilter](#action-sethwefilter)                                 | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [setCallRateFilter](#action-setcallratefilter)                       | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [setShowVerticalGuides](#action-setshowverticalguides)               | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [setShowLabels](#action-setshowlabels)                               | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [setUseGenomicPositions](#action-setusegenomicpositions)             | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [setSignedLD](#action-setsignedld)                                   | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [setJexlFilters](#action-setjexlfilters)                             | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                                                      |
| [startRenderingBackend](#action-startrenderingbackend)               | Actions    | SharedLDModel                                             | Starts the upload/render autorun.                                                                                                                                                                                                                                    |
| [performLDFetch](#action-performldfetch)                             | Actions    | SharedLDModel                                             | Re-fetches LD matrix for the current viewport.                                                                                                                                                                                                                       |
| [id](#property-id)                                                   | Properties | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                      |
| [type](#property-type)                                               | Properties | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                      |
| [rpcDriverName](#property-rpcdrivername)                             | Properties | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                      |
| [ignorePromotedDefaults](#property-ignorepromoteddefaults)           | Properties | [BaseDisplay](../basedisplay)                             | true for a display that arrived inside a session received from someone else (a share link, an encoded/json session, a `spec-` URL).                                                                                                                                  |
| [error](#volatile-error)                                             | Volatiles  | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                      |
| [statusMessage](#volatile-statusmessage)                             | Volatiles  | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                      |
| [statusProgress](#volatile-statusprogress)                           | Volatiles  | [BaseDisplay](../basedisplay)                             | determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate.                                                                                                                                                  |
| [parentTrack](#getter-parenttrack)                                   | Getters    | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                      |
| [parentDisplay](#getter-parentdisplay)                               | Getters    | [BaseDisplay](../basedisplay)                             | Returns the parent display if this display is nested within another display (e.g., PileupDisplay inside LinearAlignmentsDisplay)                                                                                                                                     |
| [RenderingComponent](#getter-renderingcomponent)                     | Getters    | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                      |
| [DisplayBlurb](#getter-displayblurb)                                 | Getters    | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                      |
| [adapterConfig](#getter-adapterconfig)                               | Getters    | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                      |
| [isMinimized](#getter-isminimized)                                   | Getters    | [BaseDisplay](../basedisplay)                             | Returns true if the parent track is minimized.                                                                                                                                                                                                                       |
| [effectiveRpcDriverName](#getter-effectiverpcdrivername)             | Getters    | [BaseDisplay](../basedisplay)                             | Returns the effective RPC driver name with hierarchical fallback: 1.                                                                                                                                                                                                 |
| [DisplayMessageComponent](#getter-displaymessagecomponent)           | Getters    | [BaseDisplay](../basedisplay)                             | if a display-level message should be displayed instead, make this return a react component                                                                                                                                                                           |
| [renderingProps](#method-renderingprops)                             | Methods    | [BaseDisplay](../basedisplay)                             | props passed to the renderer's React "Rendering" component.                                                                                                                                                                                                          |
| [setIgnorePromotedDefaults](#action-setignorepromoteddefaults)       | Actions    | [BaseDisplay](../basedisplay)                             | see the `ignorePromotedDefaults` property                                                                                                                                                                                                                            |
| [setStatusMessage](#action-setstatusmessage)                         | Actions    | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                      |
| [setError](#action-seterror)                                         | Actions    | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                      |
| [setRpcDriverName](#action-setrpcdrivername)                         | Actions    | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                      |
| [reload](#action-reload)                                             | Actions    | [BaseDisplay](../basedisplay)                             | base display reload does nothing, see specialized displays for details                                                                                                                                                                                               |
| [scrollTop](#volatile-scrolltop)                                     | Volatiles  | [TrackHeightMixin](../trackheightmixin)                   |                                                                                                                                                                                                                                                                      |
| [height](#getter-height)                                             | Getters    | [TrackHeightMixin](../trackheightmixin)                   |                                                                                                                                                                                                                                                                      |
| [setScrollTop](#action-setscrolltop)                                 | Actions    | [TrackHeightMixin](../trackheightmixin)                   |                                                                                                                                                                                                                                                                      |
| [setHeight](#action-setheight)                                       | Actions    | [TrackHeightMixin](../trackheightmixin)                   |                                                                                                                                                                                                                                                                      |
| [resizeHeight](#action-resizeheight)                                 | Actions    | [TrackHeightMixin](../trackheightmixin)                   |                                                                                                                                                                                                                                                                      |
| [canRender](#getter-canrender)                                       | Getters    | [GlobalDataDisplayMixin](../globaldatadisplaymixin)       | Same render-lifecycle precondition as MultiRegionDisplayMixin (overrides `RenderLifecycleMixin`'s default-true hook): a global display's `renderState` is still sized off view geometry (`totalWidthPx`, `dynamicBlocks`), which throws before the view is measured. |
| [displayPhase](#getter-displayphase)                                 | Getters    | [GlobalDataDisplayMixin](../globaldatadisplaymixin)       | Same precedence as MultiRegionDisplayMixin (single-sourced in `computeDisplayPhase`).                                                                                                                                                                                |
| [reloadCounter](#volatile-reloadcounter)                             | Volatiles  | [GlobalFetchMixin](../globalfetchmixin)                   | Bumped by `reload()` to retrigger a global display's fetch autorun.                                                                                                                                                                                                  |
| [svgReadyExtraTerminal](#getter-svgreadyextraterminal)               | Getters    | [GlobalFetchMixin](../globalfetchmixin)                   | Overridable hook (default false): a subclass returns true to mark an extra terminal state where off-screen export can proceed with no loaded data (mirrors `MultiRegionDisplayMixin.svgReadyExtraTerminal`).                                                         |
| [svgReady](#getter-svgready)                                         | Getters    | [GlobalFetchMixin](../globalfetchmixin)                   | Policy single-sourced in `computeSvgReady`; this family supplies only its `dataCurrent` predicate.                                                                                                                                                                   |
| [forceLoadTrack](#volatile-forceloadtrack)                           | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)             | The force-load button's answer: render this track regardless of region size or feature density.                                                                                                                                                                      |
| [byteEstimate](#volatile-byteestimate)                               | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)             | The last byte measurement for this display: the estimated bytes **and the span they cover**, which is what lets the derived gate rescale them to the span on screen now.                                                                                             |
| [gateFoldedIntoFetch](#getter-gatefoldedintofetch)                   | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)             | Additive opt-in for displays that measure the estimate inside their own feature RPC instead of a pre-flight (canvas).                                                                                                                                                |
| [configuredFetchSizeLimit](#getter-configuredfetchsizelimit)         | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)             | The composing display's configured `fetchSizeLimit`, read straight from its config.                                                                                                                                                                                  |
| [densityTooLarge](#getter-densitytoolarge)                           | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)             | Second (non-byte) too-large axis folded into the derived verdict — canvas overrides it with its feature-density gate.                                                                                                                                                |
| [adapterFetchSizeLimit](#getter-adapterfetchsizelimit)               | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)             | The adapter's own `fetchSizeLimit` slot (undefined when the adapter type declares none); `resolveByteLimit` prefers it over the display config.                                                                                                                      |
| [configForceLoad](#getter-configforceload)                           | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)             | Declarative force-load: when true the display always renders regardless of region size / feature density (the config-driven equivalent of the force-load button).                                                                                                    |
| [gateVisibleBp](#getter-gatevisiblebp)                               | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)             | The span on screen, or undefined before the view is measured.                                                                                                                                                                                                        |
| [derivedRegionTooLargeEnabled](#getter-derivedregiontoolargeenabled) | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)             | Whether the derived, self-releasing gate is live at all — the union of the two ways a display can measure: a pre-flight estimate (`byteGateEnabled`) or a byte check folded into its own feature RPC (`gateFoldedIntoFetch`).                                        |
| [byteGateExempt](#getter-bytegateexempt)                             | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)             | True when nothing may gate, on either axis and in both the worker and the banner: the declarative `forceLoad` slot, or the force-load button.                                                                                                                        |
| [estimatedBytesForVisibleSpan](#getter-estimatedbytesforvisiblespan) | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)             | How many bytes we estimate a fetch of the span on screen right now would pull, obtained by rescaling the stored measurement from the span it covers.                                                                                                                 |
| [gateByteLimit](#getter-gatebytelimit)                               | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)             | The byte budget the gate enforces: the adapter's limit, else the display config.                                                                                                                                                                                     |
| [gateActive](#getter-gateactive)                                     | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)             | Whether anything may gate at this moment: the display opted in, nothing exempts it, and the view is measured and wider than the `AUTO_FORCE_LOAD_BP` force-load floor.                                                                                               |
| [tooLargeStatus](#getter-toolargestatus)                             | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)             | The verdict the whole mixin exists to produce, with the banner text: true when the estimated download for the span on screen exceeds the resolved byte budget, or when the display's own density axis trips (bytes take precedence for the text).                    |
| [regionTooLarge](#getter-regiontoolarge)                             | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)             |                                                                                                                                                                                                                                                                      |
| [regionTooLargeReason](#getter-regiontoolargereason)                 | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)             | Which axis tripped, as banner text: the estimated download size, or "Too many features".                                                                                                                                                                             |
| [resolvedByteLimit](#method-resolvedbytelimit)                       | Methods    | [RegionTooLargeMixin](../regiontoolargemixin)             | The byte budget a fetch RPC enforces worker-side, short-circuiting an over-budget region before it downloads any features.                                                                                                                                           |
| [setByteEstimate](#action-setbyteestimate)                           | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)             | Commits a byte measurement: the estimate together with the span it covers, so the derived gate can rescale it to the span on screen.                                                                                                                                 |
| [clearByteEstimate](#action-clearbyteestimate)                       | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)             | Drops the cached estimate.                                                                                                                                                                                                                                           |
| [setForceLoadTrack](#action-setforceloadtrack)                       | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)             | Exempt this track from the gate (or put it back under it).                                                                                                                                                                                                           |
| [forceLoad](#action-forceload)                                       | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)             | Force-load: exempt this track from the gate and refetch.                                                                                                                                                                                                             |
| [byteGateBlocksFetch](#action-bytegateblocksfetch)                   | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)             | The entire pre-flight gate for one fetch: measure the region set, commit the estimate with the span it covers, and answer whether the caller must abandon the fetch — either superseded mid-measure, or over budget.                                                 |
| [activeStopToken](#volatile-activestoptoken)                         | Volatiles  | [FetchMixin](../fetchmixin)                               | stop token of the in-flight fetch, or undefined when idle                                                                                                                                                                                                            |
| [fetchGeneration](#volatile-fetchgeneration)                         | Volatiles  | [FetchMixin](../fetchmixin)                               | bumps at every fetch end; autoruns read it to re-evaluate, and it doubles as the staleness epoch inside runFetch                                                                                                                                                     |
| [fetchCanceled](#volatile-fetchcanceled)                             | Volatiles  | [FetchMixin](../fetchmixin)                               | true after the user explicitly cancels a load (the loading overlay's cancel button → `cancelFetchByUser`).                                                                                                                                                           |
| [regionStatuses](#volatile-regionstatuses)                           | Volatiles  | [FetchMixin](../fetchmixin)                               | latest status of each concurrent in-flight operation, keyed by an arbitrary id (the canvas display uses displayedRegionIndex).                                                                                                                                       |
| [isLoading](#getter-isloading)                                       | Getters    | [FetchMixin](../fetchmixin)                               | true while a fetch is active                                                                                                                                                                                                                                         |
| [makeStatusCallback](#method-makestatuscallback)                     | Methods    | [FetchMixin](../fetchmixin)                               | An RPC `statusCallback` bound to this display: forwards progress to the shared `statusMessage`, guarded by `isAlive` so a callback that fires after the node is torn down (RPCs resolve their status stream asynchronously) is a safe no-op.                         |
| [makeRegionStatusCallback](#method-makeregionstatuscallback)         | Methods    | [FetchMixin](../fetchmixin)                               | Per-region variant of `makeStatusCallback`: routes progress through `setRegionStatus(key, …)` so N concurrent per-region fetches aggregate into one status bar instead of clobbering each other.                                                                     |
| [throttleStatus](#action-throttlestatus)                             | Actions    | [FetchMixin](../fetchmixin)                               | Run `apply` only if the throttle window has elapsed.                                                                                                                                                                                                                 |
| [resetStatus](#action-resetstatus)                                   | Actions    | [FetchMixin](../fetchmixin)                               | Drop the active stop token and clear all status bookkeeping.                                                                                                                                                                                                         |
| [stopActiveFetch](#action-stopactivefetch)                           | Actions    | [FetchMixin](../fetchmixin)                               | Abort the in-flight fetch (if any) and clear its status.                                                                                                                                                                                                             |
| [setRegionStatus](#action-setregionstatus)                           | Actions    | [FetchMixin](../fetchmixin)                               | Record one concurrent operation's latest status (keyed) and recompute the shared statusMessage/statusProgress as the aggregate across all in-flight keys.                                                                                                            |
| [cancelFetch](#action-cancelfetch)                                   | Actions    | [FetchMixin](../fetchmixin)                               | cancel any in-flight fetch and bump fetchGeneration (always bumps, so callers can retrigger fetch autoruns even when nothing was in flight).                                                                                                                         |
| [cancelFetchByUser](#action-cancelfetchbyuser)                       | Actions    | [FetchMixin](../fetchmixin)                               | User-initiated cancel from the loading overlay.                                                                                                                                                                                                                      |
| [beforeDestroy](#action-beforedestroy)                               | Actions    | [FetchMixin](../fetchmixin)                               | Release an in-flight fetch's stop token on teardown.                                                                                                                                                                                                                 |
| [runFetch](#action-runfetch)                                         | Actions    | [FetchMixin](../fetchmixin)                               | Run a cancel-safe fetch (cancels any prior).                                                                                                                                                                                                                         |
| [canvasDrawn](#volatile-canvasdrawn)                                 | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)           | flips true on first paint; read by test selectors to detect render                                                                                                                                                                                                   |
| [currentRenderingBackend](#volatile-currentrenderingbackend)         | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)           | current backend reference, updated on context-loss recovery.                                                                                                                                                                                                         |
| [renderTick](#volatile-rendertick)                                   | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)           | counter the render autorun observes; bumped to force a re-render                                                                                                                                                                                                     |
| [autorunsInstalled](#volatile-autorunsinstalled)                     | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)           | guards attachRenderingBackend so the autorun pair spawns once per instance                                                                                                                                                                                           |
| [renderError](#volatile-rendererror)                                 | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)           | the render-backend (GPU/Canvas2D init or context-loss) error, or undefined.                                                                                                                                                                                          |
| [markCanvasDrawn](#action-markcanvasdrawn)                           | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)           |                                                                                                                                                                                                                                                                      |
| [resetCanvasDrawn](#action-resetcanvasdrawn)                         | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)           |                                                                                                                                                                                                                                                                      |
| [stopRenderingBackend](#action-stoprenderingbackend)                 | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)           |                                                                                                                                                                                                                                                                      |
| [renderNow](#action-rendernow)                                       | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)           |                                                                                                                                                                                                                                                                      |
| [setRenderError](#action-setrendererror)                             | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)           | set/clear the render-backend error.                                                                                                                                                                                                                                  |
| [attachRenderingBackend](#action-attachrenderingbackend)             | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)           | attach a GPU/Canvas2D backend and install the upload + render autorun pair (idempotent — re-calling only swaps the backend)                                                                                                                                          |
| [lastDrawnOffsetPx](#volatile-lastdrawnoffsetpx)                     | Volatiles  | [StaleViewportRescaleMixin](../staleviewportrescalemixin) | offsetPx of the viewport when the canvas was last fully drawn                                                                                                                                                                                                        |
| [lastDrawnBpPerPx](#volatile-lastdrawnbpperpx)                       | Volatiles  | [StaleViewportRescaleMixin](../staleviewportrescalemixin) | bpPerPx of the viewport when the canvas was last fully drawn                                                                                                                                                                                                         |
| [setLastDrawnViewport](#action-setlastdrawnviewport)                 | Actions    | [StaleViewportRescaleMixin](../staleviewportrescalemixin) |                                                                                                                                                                                                                                                                      |

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

#### getter: dataCurrent

The shared freshness hook, read by `GlobalFetchMixin.svgReady`. The fetch
commits `rpcData` even for an empty viewport, so this flips true once data has
loaded AND that data was fetched for the current viewport. Gating on freshness —
not merely `rpcData !== null` — keeps off-screen `svgReady` from resolving on
data left over from the pre-pan/zoom viewport during the debounced-refetch
window (`setLastDrawnViewport` runs right after `setRpcData`). Without the
override the mixin default (`false`) leaves `svgReady` unable to resolve on a
successful load, hanging SVG export.

```ts
type dataCurrent = boolean
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

#### getter: byteGateEnabled

Opt into RegionTooLargeMixin's derived byte gate (byte axis only, no density
axis), except for pre-computed LD. `CoreGetRegionByteEstimate` measures via
`getFeatures`, which only the VCF-computed path's feature adapter implements — a
PlinkLD* adapter would throw "Adapter does not support retrieving features", and
it ships pre-thinned files that need no gate anyway.

```ts
type byteGateEnabled = boolean
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
type renderState = LDRenderState
```

#### getter: connectorLineCoords

The connector lines tying each matrix column to its SNP's genomic position, in
viewport pixels, plus the label the hover tooltip and `VariantLabels` show. Only
meaningful in index mode (genomic-positions mode already draws columns at their
genomic x).

```ts
type connectorLineCoords = ConnectorCoord[]
```

</details>

<details>
<summary>SharedLDModel - Getters (other undocumented members)</summary>

| Member                                                                         | Type                                                                           |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| <span id="getter-prefersoffset">prefersOffset</span>                           | `boolean`                                                                      |
| <span id="getter-minorallelefrequencyfilter">minorAlleleFrequencyFilter</span> | `number`                                                                       |
| <span id="getter-lengthcutofffilter">lengthCutoffFilter</span>                 | `number`                                                                       |
| <span id="getter-linezoneheight">lineZoneHeight</span>                         | `number`                                                                       |
| <span id="getter-ldmetric">ldMetric</span>                                     | `"r2" \| "dprime"`                                                             |
| <span id="getter-showlegend">showLegend</span>                                 | `boolean`                                                                      |
| <span id="getter-showldtriangle">showLDTriangle</span>                         | `boolean`                                                                      |
| <span id="getter-showrecombination">showRecombination</span>                   | `boolean`                                                                      |
| <span id="getter-recombinationzoneheight">recombinationZoneHeight</span>       | `number`                                                                       |
| <span id="getter-fittoheight">fitToHeight</span>                               | `boolean`                                                                      |
| <span id="getter-hwefilterthreshold">hweFilterThreshold</span>                 | `number`                                                                       |
| <span id="getter-callratefilter">callRateFilter</span>                         | `number`                                                                       |
| <span id="getter-showverticalguides">showVerticalGuides</span>                 | `boolean`                                                                      |
| <span id="getter-showlabels">showLabels</span>                                 | `boolean`                                                                      |
| <span id="getter-tickheight">tickHeight</span>                                 | `number`                                                                       |
| <span id="getter-usegenomicpositions">useGenomicPositions</span>               | `boolean`                                                                      |
| <span id="getter-signedld">signedLD</span>                                     | `boolean`                                                                      |
| <span id="getter-jexlfilters">jexlFilters</span>                               | `string[]`                                                                     |
| <span id="getter-cellwidth">cellWidth</span>                                   | `number`                                                                       |
| <span id="getter-filterstats">filterStats</span>                               | `FilterStats \| undefined`                                                     |
| <span id="getter-recombination">recombination</span>                           | `{ values: Float32Array<ArrayBufferLike>; positions: number[]; } \| undefined` |
| <span id="getter-isprecomputedld">isPrecomputedLD</span>                       | `boolean`                                                                      |

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

#### getter: canRender

Same render-lifecycle precondition as MultiRegionDisplayMixin (overrides
`RenderLifecycleMixin`'s default-true hook): a global display's `renderState` is
still sized off view geometry (`totalWidthPx`, `dynamicBlocks`), which throws
before the view is measured. Gating the autorun pair here keeps that out of
every display's callbacks.

```ts
type canRender = boolean
```

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

Policy single-sourced in `computeSvgReady`; this family supplies only its
`dataCurrent` predicate. Note it requires the dataset to actually be current,
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
