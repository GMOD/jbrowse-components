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

| Member                                                             | Kind       | Defined by                                                | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------ | ---------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [configuration](#property-configuration)                           | Properties | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [rpcData](#volatile-rpcdata)                                       | Volatiles  | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [focalSnpLocus](#volatile-focalsnplocus)                           | Volatiles  | SharedLDModel                                             | Locus (`refName:start`) of the focal SNP whose LD row+column is emphasized, or undefined. Keyed by locus rather than array index so the selection survives a re-fetch that reorders SNPs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [byteEstimateVisibleBp](#volatile-byteestimatevisiblebp)           | Volatiles  | SharedLDModel                                             | visibleBp at which the current `featureDensityStats` byte estimate was captured, so the derived `regionTooLarge` getter can scale it to the currently visible span (mirrors canvas's byteEstimateVisibleBp).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [estimatedVisibleBytes](#getter-estimatedvisiblebytes)             | Getters    | SharedLDModel                                             | The cached byte estimate scaled from the span it was measured over (`byteEstimateVisibleBp`) to the currently visible span. Roughly proportional to span, so scaling makes the verdict a pure function of the current view and self-releases on zoom-in — without it a large zoomed-out estimate stays above the limit forever and gates refetch.                                                                                                                                                                                                                                                                                                                                                        |
| [tooLargeStatus](#getter-toolargestatus)                           | Getters    | SharedLDModel                                             | Shared verdict + reason (AUTO_FORCE_LOAD_BP floor + bytes-over-limit), fed the scaled estimate so the byte gate self-releases on zoom-in. Same helper as every other gating path so the banner text can't drift.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [regionTooLarge](#getter-regiontoolarge)                           | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [regionTooLargeReason](#getter-regiontoolargereason)               | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [prefersOffset](#getter-prefersoffset)                             | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [minorAlleleFrequencyFilter](#getter-minorallelefrequencyfilter)   | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [lengthCutoffFilter](#getter-lengthcutofffilter)                   | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [lineZoneHeight](#getter-linezoneheight)                           | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [ldMetric](#getter-ldmetric)                                       | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [showLegend](#getter-showlegend)                                   | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [showLDTriangle](#getter-showldtriangle)                           | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [showRecombination](#getter-showrecombination)                     | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [recombinationZoneHeight](#getter-recombinationzoneheight)         | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [fitToHeight](#getter-fittoheight)                                 | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [hweFilterThreshold](#getter-hwefilterthreshold)                   | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [callRateFilter](#getter-callratefilter)                           | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [showVerticalGuides](#getter-showverticalguides)                   | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [showLabels](#getter-showlabels)                                   | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [tickHeight](#getter-tickheight)                                   | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [useGenomicPositions](#getter-usegenomicpositions)                 | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [signedLD](#getter-signedld)                                       | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [jexlFilters](#getter-jexlfilters)                                 | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [snps](#getter-snps)                                               | Getters    | SharedLDModel                                             | Returns true if this display uses pre-computed LD data (PLINK, ldmat) rather than computing LD from VCF genotypes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [cellWidth](#getter-cellwidth)                                     | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [filterStats](#getter-filterstats)                                 | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [recombination](#getter-recombination)                             | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [dataLoaded](#getter-dataloaded)                                   | Getters    | SharedLDModel                                             | Global-display data-loaded signal read by `GlobalDataDisplayMixin.svgReady` (analog of `viewportWithinLoadedData`). The fetch commits `rpcData` even for an empty viewport, so this flips true once data has loaded AND that data was fetched for the current viewport. Gating on freshness — not merely `rpcData !== null` — keeps off-screen `svgReady` from resolving on data left over from the pre-pan/zoom viewport during the debounced-refetch window (`setLastDrawnViewport` runs right after `setRpcData`). Without the override the mixin default (`false`) leaves `svgReady` unable to resolve on a successful load, hanging SVG export.                                                     |
| [isPrecomputedLD](#getter-isprecomputedld)                         | Getters    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [effectiveLdMetric](#getter-effectiveldmetric)                     | Getters    | SharedLDModel                                             | Metric the loaded data actually represents. A pre-computed file with no D' column downgrades a 'dprime' request to 'r2', so the legend and the metric radios read this rather than the raw requested `ldMetric`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [dprimeAvailable](#getter-dprimeavailable)                         | Getters    | SharedLDModel                                             | Whether the D' metric can be shown — false only for a pre-computed file lacking a DP column, which disables the D' option.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [ldMethod](#getter-ldmethod)                                       | Getters    | SharedLDModel                                             | How the loaded LD values were derived: 'phased' (exact haplotypic), 'composite' (Weir estimate from unphased genotypes), or 'precomputed' (read from a PLINK/ldmat file). Undefined until data loads.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [focalSnpIndex](#getter-focalsnpindex)                             | Getters    | SharedLDModel                                             | Array index of the focal SNP in the current `snps`, or -1 if none is selected or the locus is no longer present after a re-fetch.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [effectiveLineZoneHeight](#getter-effectivelinezoneheight)         | Getters    | SharedLDModel                                             | Pixel height of the SVG zone above the canvas (variant labels + lines, or recombination scale). The hit-test subtracts this from mouseY before reversing the render transform.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [ldCanvasHeight](#getter-ldcanvasheight)                           | Getters    | SharedLDModel                                             | Effective height for the LD canvas (total height minus the zone the recombination overlay / variant lines occupy above the matrix).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [yScalar](#getter-yscalar)                                         | Getters    | SharedLDModel                                             | Per-frame yScalar squash factor. When fitToHeight is on, squashes the natural (canvasWidth/2) triangle into ldCanvasHeight. Lives on the main thread so resize doesn't trigger a worker re-fetch.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [renderTransform](#getter-rendertransform)                         | Getters    | SharedLDModel                                             | Forward transform { scale, viewOffsetX } shared by GPU render, mouse hit-test, and the matrix→genomic-position SVG lines. See `computeRenderTransform` for the math.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [renderState](#getter-renderstate)                                 | Getters    | SharedLDModel                                             | Per-frame render state for the GPU backend. Read by the upload/render autorun — every change to any tracked observable (view.bpPerPx, view.offsetPx, model.fitToHeight, rpcData contents, …) re-fires it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [rpcProps](#method-rpcprops)                                       | Methods    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [hitTest](#method-hittest)                                         | Methods    | SharedLDModel                                             | Inverse of `renderTransform` for the LD matrix: takes mouse coords (canvas-relative) and returns the LD cell under the cursor, or undefined. Mirrors plugins/hic's `hitTest` so both contact maps keep the forward and inverse transforms paired on the model.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [filterMenuItems](#method-filtermenuitems)                         | Methods    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [legendItems](#method-legenditems)                                 | Methods    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [svgLegendWidth](#method-svglegendwidth)                           | Methods    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [trackMenuItems](#method-trackmenuitems)                           | Methods    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [renderSvg](#method-rendersvg)                                     | Methods    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setRpcData](#action-setrpcdata)                                   | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setFocalSnp](#action-setfocalsnp)                                 | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setLineZoneHeight](#action-setlinezoneheight)                     | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setMafFilter](#action-setmaffilter)                               | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setLDMetric](#action-setldmetric)                                 | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setShowLegend](#action-setshowlegend)                             | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setShowLDTriangle](#action-setshowldtriangle)                     | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setShowRecombination](#action-setshowrecombination)               | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setFitToHeight](#action-setfittoheight)                           | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setHweFilter](#action-sethwefilter)                               | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setCallRateFilter](#action-setcallratefilter)                     | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setShowVerticalGuides](#action-setshowverticalguides)             | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setShowLabels](#action-setshowlabels)                             | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setUseGenomicPositions](#action-setusegenomicpositions)           | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setSignedLD](#action-setsignedld)                                 | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setJexlFilters](#action-setjexlfilters)                           | Actions    | SharedLDModel                                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setFeatureDensityStats](#action-setfeaturedensitystats)           | Actions    | SharedLDModel                                             | Records the span the byte estimate was measured at so the derived `regionTooLarge` getter can scale it to the current view (mirrors canvas's setFeatureDensityStats override).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [setFeatureDensityStatsLimit](#action-setfeaturedensitystatslimit) | Actions    | SharedLDModel                                             | Force-load raises the byte gate past the estimate scaled to the _current_ view (`estimatedVisibleBytes`), not the raw captured bytes. The derived gate compares against the scaled estimate, so if the view zoomed out between the estimate capture and the force-load click, raising past the raw bytes would leave the estimate above the new limit and the banner up. Mirrors canvas's override; without it the shared RegionTooLargeMixin default (raw bytes) under-raises this derived, scale-aware path.                                                                                                                                                                                           |
| [startRenderingBackend](#action-startrenderingbackend)             | Actions    | SharedLDModel                                             | Starts the upload/render autorun. Data + color ramp both derive from the same rpcData object, so a single identity-diffed slot handles both uploads.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [performLDFetch](#action-performldfetch)                           | Actions    | SharedLDModel                                             | Re-fetches LD matrix for the current viewport. Both the autorun (in `afterAttach`) and `reload()` invoke this directly.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [id](#property-id)                                                 | Properties | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [type](#property-type)                                             | Properties | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [rpcDriverName](#property-rpcdrivername)                           | Properties | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [ignorePromotedDefaults](#property-ignorepromoteddefaults)         | Properties | [BaseDisplay](../basedisplay)                             | true for a display that arrived inside a session received from someone else (a share link, an encoded/json session, a `spec-` URL). Such a display resolves its `promotable` config slots from its own config only, never from this browser's promoted display-type defaults (see `configuration/promotableDefaults.ts`) — the received session is a record of what the sender saw, and a local preference silently repainting it would make it a lie. A track opened _afterwards_ in that same session is a fresh track of this user's, so it never gets the flag and picks up their defaults normally. Cleared by `resetSlotsToInherit` when the user deliberately makes the display follow a default. |
| [error](#volatile-error)                                           | Volatiles  | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [statusMessage](#volatile-statusmessage)                           | Volatiles  | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [statusProgress](#volatile-statusprogress)                         | Volatiles  | [BaseDisplay](../basedisplay)                             | determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate. Set alongside `statusMessage` by `setStatusMessage`; a display that never shows a bar simply leaves it undefined.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [parentTrack](#getter-parenttrack)                                 | Getters    | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [parentDisplay](#getter-parentdisplay)                             | Getters    | [BaseDisplay](../basedisplay)                             | Returns the parent display if this display is nested within another display (e.g., PileupDisplay inside LinearAlignmentsDisplay)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [RenderingComponent](#getter-renderingcomponent)                   | Getters    | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [DisplayBlurb](#getter-displayblurb)                               | Getters    | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [adapterConfig](#getter-adapterconfig)                             | Getters    | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [isMinimized](#getter-isminimized)                                 | Getters    | [BaseDisplay](../basedisplay)                             | Returns true if the parent track is minimized. Used to skip expensive operations like autoruns when track is not visible.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [effectiveRpcDriverName](#getter-effectiverpcdrivername)           | Getters    | [BaseDisplay](../basedisplay)                             | Returns the effective RPC driver name with hierarchical fallback: 1. This display's explicit rpcDriverName 2. Parent display's effectiveRpcDriverName (for nested displays) 3. Track config's rpcDriverName                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [DisplayMessageComponent](#getter-displaymessagecomponent)         | Getters    | [BaseDisplay](../basedisplay)                             | if a display-level message should be displayed instead, make this return a react component                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [renderingProps](#method-renderingprops)                           | Methods    | [BaseDisplay](../basedisplay)                             | props passed to the renderer's React "Rendering" component. these are client-side only and never sent to the worker. includes displayModel and callbacks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [regionCannotBeRendered](#method-regioncannotberendered)           | Methods    | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setIgnorePromotedDefaults](#action-setignorepromoteddefaults)     | Actions    | [BaseDisplay](../basedisplay)                             | see the `ignorePromotedDefaults` property                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [setStatusMessage](#action-setstatusmessage)                       | Actions    | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setError](#action-seterror)                                       | Actions    | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setRpcDriverName](#action-setrpcdrivername)                       | Actions    | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [reload](#action-reload)                                           | Actions    | [BaseDisplay](../basedisplay)                             | base display reload does nothing, see specialized displays for details                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [scrollTop](#volatile-scrolltop)                                   | Volatiles  | [TrackHeightMixin](../trackheightmixin)                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [height](#getter-height)                                           | Getters    | [TrackHeightMixin](../trackheightmixin)                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setScrollTop](#action-setscrolltop)                               | Actions    | [TrackHeightMixin](../trackheightmixin)                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setHeight](#action-setheight)                                     | Actions    | [TrackHeightMixin](../trackheightmixin)                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [resizeHeight](#action-resizeheight)                               | Actions    | [TrackHeightMixin](../trackheightmixin)                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [displayPhase](#getter-displayphase)                               | Getters    | [GlobalDataDisplayMixin](../globaldatadisplaymixin)       | Same precedence as MultiRegionDisplayMixin (single-sourced in `computeDisplayPhase`). A global display has no per-region staleness axis — it either has its one dataset or is fetching it — so its `loading` axis is simply "fetch in flight". Reads `renderError` (RenderLifecycleMixin), which is why it lives here, not in GlobalFetchMixin.                                                                                                                                                                                                                                                                                                                                                          |
| [reloadCounter](#volatile-reloadcounter)                           | Volatiles  | [GlobalFetchMixin](../globalfetchmixin)                   | Bumped by `reload()` to retrigger a global display's fetch autorun. Each display reads `void self.reloadCounter` in its `afterAttach` fetch autorun so a user-initiated reload re-runs the fetch even when no viewport/setting changed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [svgReadyExtraTerminal](#getter-svgreadyextraterminal)             | Getters    | [GlobalFetchMixin](../globalfetchmixin)                   | Overridable hook (default false): a subclass returns true to mark an extra terminal state where off-screen export can proceed with no loaded data (mirrors `MultiRegionDisplayMixin.svgReadyExtraTerminal`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [svgReady](#getter-svgready)                                       | Getters    | [GlobalFetchMixin](../globalfetchmixin)                   | Global-display analog of `MultiRegionDisplayMixin.svgReady`: true once an off-screen (SVG) export can read final data. Like that mixin it requires the dataset to actually be loaded (or a terminal error / too-large / extra state), NOT merely "not currently fetching": the fetch trigger is a debounced `afterAttach` autorun, so at export time `isLoading` can still be false with no data yet — a `displayPhase !== 'loading'` test would then capture an empty render. Never gates on `canvasDrawn`, which an off-screen export never sets. Off-screen renderers gate on it via `awaitSvgReady(model)`.                                                                                          |
| [userByteSizeLimit](#property-userbytesizelimit)                   | Properties | [RegionTooLargeMixin](../regiontoolargemixin)             | user-confirmed byte limit after a force-load, disabling the gate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [regionTooLargeState](#volatile-regiontoolargestate)               | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [regionTooLargeReasonState](#volatile-regiontoolargereasonstate)   | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [featureDensityStats](#volatile-featuredensitystats)               | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [regionCannotBeRenderedText](#method-regioncannotberenderedtext)   | Methods    | [RegionTooLargeMixin](../regiontoolargemixin)             | Plaintext reason (for SVG export); the on-screen too-large UI is rendered by the display chrome via `TooLargeMessage`, not the model.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [setRegionTooLarge](#action-setregiontoolarge)                     | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [forceLoad](#action-forceload)                                     | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)             | Raises the byte limit past the current density stats and triggers a reload. The display chrome calls this via TooLargeMessage's force-load button; concrete display models override reload() to do the actual refetch.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [activeStopToken](#volatile-activestoptoken)                       | Volatiles  | [FetchMixin](../fetchmixin)                               | stop token of the in-flight fetch, or undefined when idle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [fetchGeneration](#volatile-fetchgeneration)                       | Volatiles  | [FetchMixin](../fetchmixin)                               | bumps at every fetch end; autoruns read it to re-evaluate, and it doubles as the staleness epoch inside runFetch                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [fetchCanceled](#volatile-fetchcanceled)                           | Volatiles  | [FetchMixin](../fetchmixin)                               | true after the user explicitly cancels a load (the loading overlay's cancel button → `cancelFetchByUser`). A durable, blocking state — unlike `cancelFetch`, it does not retrigger the fetch autoruns — so the load stays stopped until the user retries (`reload`) or the viewport changes. Any new fetch clears it (`runFetch` resets it at the start).                                                                                                                                                                                                                                                                                                                                                |
| [regionStatuses](#volatile-regionstatuses)                         | Volatiles  | [FetchMixin](../fetchmixin)                               | latest status of each concurrent in-flight operation, keyed by an arbitrary id (the canvas display uses displayedRegionIndex). Plain bookkeeping — not read reactively; setRegionStatus derives the observable statusMessage/statusProgress from it on every update so N parallel region fetches aggregate into one bar instead of clobbering.                                                                                                                                                                                                                                                                                                                                                           |
| [lastStatusMs](#volatile-laststatusms)                             | Volatiles  | [FetchMixin](../fetchmixin)                               | Date.now() of the last applied status write; the status callbacks gate on it to throttle a high-frequency progress stream.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [isLoading](#getter-isloading)                                     | Getters    | [FetchMixin](../fetchmixin)                               | true while a fetch is active                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [makeStatusCallback](#method-makestatuscallback)                   | Methods    | [FetchMixin](../fetchmixin)                               | An RPC `statusCallback` bound to this display: forwards progress to the shared `statusMessage`, guarded by `isAlive` so a callback that fires after the node is torn down (RPCs resolve their status stream asynchronously) is a safe no-op. Pass directly as the `statusCallback` RPC arg instead of re-inlining the guard at every call site.                                                                                                                                                                                                                                                                                                                                                          |
| [makeRegionStatusCallback](#method-makeregionstatuscallback)       | Methods    | [FetchMixin](../fetchmixin)                               | Per-region variant of `makeStatusCallback`: routes progress through `setRegionStatus(key, …)` so N concurrent per-region fetches aggregate into one status bar instead of clobbering each other. Same `isAlive` guard.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [throttleStatus](#action-throttlestatus)                           | Actions    | [FetchMixin](../fetchmixin)                               | Run `apply` only if at least `STATUS_THROTTLE_MS` has passed since the last status write. A leading-edge throttle: sparse updates pass straight through, dense progress bursts are thinned so the loading overlay stops re-rendering faster than the view animates. The final status doesn't need a trailing flush — fetch completion clears it via `resetStatus`.                                                                                                                                                                                                                                                                                                                                       |
| [resetStatus](#action-resetstatus)                                 | Actions    | [FetchMixin](../fetchmixin)                               | Drop the active stop token and clear all status bookkeeping. Shared by both cancel paths and runFetch's cleanup.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [stopActiveFetch](#action-stopactivefetch)                         | Actions    | [FetchMixin](../fetchmixin)                               | Abort the in-flight fetch (if any) and clear its status. The shared preamble of both cancel paths; the difference between them is only what they do to `fetchCanceled` / `fetchGeneration` afterward.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [setRegionStatus](#action-setregionstatus)                         | Actions    | [FetchMixin](../fetchmixin)                               | Record one concurrent operation's latest status (keyed) and recompute the shared statusMessage/statusProgress as the aggregate across all in-flight keys. Pass undefined to drop a key. Used by displays that fan a single fetch out into parallel per-region RPCs.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [cancelFetch](#action-cancelfetch)                                 | Actions    | [FetchMixin](../fetchmixin)                               | cancel any in-flight fetch and bump fetchGeneration (always bumps, so callers can retrigger fetch autoruns even when nothing was in flight). This is the _internal_ reset used by clearAllRpcData/invalidateLoadedRegions — it clears any user-cancel flag so the retrigger actually re-fetches.                                                                                                                                                                                                                                                                                                                                                                                                         |
| [cancelFetchByUser](#action-cancelfetchbyuser)                     | Actions    | [FetchMixin](../fetchmixin)                               | User-initiated cancel from the loading overlay. Stops the in-flight fetch and lands in a durable `fetchCanceled` state. Unlike `cancelFetch`, it does NOT bump fetchGeneration — so the fetch autoruns don't immediately restart the load. The user retries via `reload` (the overlay's retry button), or it clears on the next viewport change.                                                                                                                                                                                                                                                                                                                                                         |
| [runFetch](#action-runfetch)                                       | Actions    | [FetchMixin](../fetchmixin)                               | Run a cancel-safe fetch (cancels any prior). The work callback gets a FetchContext with a stopToken to forward to the RPC and an isStale() check to short-circuit commits once the user has moved on. Abort errors are swallowed; others are stored in `error` if not stale.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [canvasDrawn](#volatile-canvasdrawn)                               | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)           | flips true on first paint; read by test selectors to detect render                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [currentRenderingBackend](#volatile-currentrenderingbackend)       | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)           | current backend reference, updated on context-loss recovery. Typed `unknown` (not generic `B`) on purpose: this mixin is composed by every display via a non-generic factory, so the per-display backend type `B` isn't known here — it's supplied at `attachRenderingBackend<B>` and narrowed with `as B` inside the autoruns. Don't "fix" the cast.                                                                                                                                                                                                                                                                                                                                                    |
| [renderTick](#volatile-rendertick)                                 | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)           | counter the render autorun observes; bumped to force a re-render                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [autorunsInstalled](#volatile-autorunsinstalled)                   | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)           | guards attachRenderingBackend so the autorun pair spawns once per instance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [renderError](#volatile-rendererror)                               | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)           | the render-backend (GPU/Canvas2D init or context-loss) error, or undefined. Single source of truth for the render-error terminal state: `useRenderingBackend` writes it from the canvas-init mechanism so the model — not React-local hook state — owns every terminal state. Read by `displayPhase` (whose `renderError` term outranks `loading`, suppressing the scrim) and by `DisplayChrome` (shows the retry overlay).                                                                                                                                                                                                                                                                              |
| [markCanvasDrawn](#action-markcanvasdrawn)                         | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)           |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [resetCanvasDrawn](#action-resetcanvasdrawn)                       | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)           |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [stopRenderingBackend](#action-stoprenderingbackend)               | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)           |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [renderNow](#action-rendernow)                                     | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)           |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setRenderError](#action-setrendererror)                           | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)           | set/clear the render-backend error. Called by `useRenderingBackend`: with the error when the canvas factory rejects (or context-loss re-init fails), and with `undefined` on successful (re)init and on retry.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [attachRenderingBackend](#action-attachrenderingbackend)           | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)           | attach a GPU/Canvas2D backend and install the upload + render autorun pair (idempotent — re-calling only swaps the backend)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [lastDrawnOffsetPx](#volatile-lastdrawnoffsetpx)                   | Volatiles  | [StaleViewportRescaleMixin](../staleviewportrescalemixin) | offsetPx of the viewport when the canvas was last fully drawn                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [lastDrawnBpPerPx](#volatile-lastdrawnbpperpx)                     | Volatiles  | [StaleViewportRescaleMixin](../staleviewportrescalemixin) | bpPerPx of the viewport when the canvas was last fully drawn                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [setLastDrawnViewport](#action-setlastdrawnviewport)               | Actions    | [StaleViewportRescaleMixin](../staleviewportrescalemixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

<details>
<summary>SharedLDModel - Properties</summary>

#### property: configuration

```ts
// type signature
type configuration = ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

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

#### volatile: byteEstimateVisibleBp

visibleBp at which the current `featureDensityStats` byte estimate was captured,
so the derived `regionTooLarge` getter can scale it to the currently visible
span (mirrors canvas's byteEstimateVisibleBp).

```ts
// type signature
type byteEstimateVisibleBp = number | undefined
// code
byteEstimateVisibleBp: undefined as number | undefined
```

</details>

<details>
<summary>SharedLDModel - Volatiles (other undocumented members)</summary>

#### volatile: rpcData

```ts
// type signature
type rpcData = LDDataResult | null
// code
rpcData: null as LDDataResult | null
```

</details>

<details>
<summary>SharedLDModel - Getters</summary>

#### getter: estimatedVisibleBytes

The cached byte estimate scaled from the span it was measured over
(`byteEstimateVisibleBp`) to the currently visible span. Roughly proportional to
span, so scaling makes the verdict a pure function of the current view and
self-releases on zoom-in — without it a large zoomed-out estimate stays above
the limit forever and gates refetch.

```ts
type estimatedVisibleBytes = number | undefined
```

#### getter: tooLargeStatus

Shared verdict + reason (AUTO_FORCE_LOAD_BP floor + bytes-over-limit), fed the
scaled estimate so the byte gate self-releases on zoom-in. Same helper as every
other gating path so the banner text can't drift.

```ts
type tooLargeStatus = RegionTooLargeStatus
```

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
type effectiveLineZoneHeight = any
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

#### getter: regionTooLarge

```ts
type regionTooLarge = boolean
```

#### getter: regionTooLargeReason

```ts
type regionTooLargeReason = string
```

#### getter: prefersOffset

```ts
type prefersOffset = boolean
```

#### getter: minorAlleleFrequencyFilter

```ts
type minorAlleleFrequencyFilter = any
```

#### getter: lengthCutoffFilter

```ts
type lengthCutoffFilter = any
```

#### getter: lineZoneHeight

```ts
type lineZoneHeight = any
```

#### getter: ldMetric

```ts
type ldMetric = any
```

#### getter: showLegend

```ts
type showLegend = any
```

#### getter: showLDTriangle

```ts
type showLDTriangle = any
```

#### getter: showRecombination

```ts
type showRecombination = any
```

#### getter: recombinationZoneHeight

```ts
type recombinationZoneHeight = any
```

#### getter: fitToHeight

```ts
type fitToHeight = any
```

#### getter: hweFilterThreshold

```ts
type hweFilterThreshold = any
```

#### getter: callRateFilter

```ts
type callRateFilter = any
```

#### getter: showVerticalGuides

```ts
type showVerticalGuides = any
```

#### getter: showLabels

```ts
type showLabels = any
```

#### getter: tickHeight

```ts
type tickHeight = any
```

#### getter: useGenomicPositions

```ts
type useGenomicPositions = any
```

#### getter: signedLD

```ts
type signedLD = any
```

#### getter: jexlFilters

```ts
type jexlFilters = string[]
```

#### getter: cellWidth

```ts
type cellWidth = number
```

#### getter: filterStats

```ts
type filterStats = FilterStats | undefined
```

#### getter: recombination

```ts
type recombination =
  { values: Float32Array<ArrayBufferLike>; positions: number[] } | undefined
```

#### getter: isPrecomputedLD

```ts
type isPrecomputedLD = boolean
```

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

#### method: rpcProps

```ts
type rpcProps = () => {
  ldMetric: any
  minorAlleleFrequencyFilter: any
  lengthCutoffFilter: any
  hweFilterThreshold: any
  callRateFilter: any
  jexlFilters: string[]
  signedLD: any
  useGenomicPositions: any
}
```

#### method: filterMenuItems

```ts
type filterMenuItems = () => { label: string; onClick: () => void }[]
```

#### method: legendItems

```ts
type legendItems = () => LegendItem[]
```

#### method: svgLegendWidth

```ts
type svgLegendWidth = () => number
```

#### method: trackMenuItems

```ts
type trackMenuItems = () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | CustomMenuItem | { ...; } | { ...; } | { ...; })[]
```

#### method: renderSvg

```ts
type renderSvg = (opts: ExportSvgDisplayOptions) => Promise<ReactNode>
```

</details>

<details>
<summary>SharedLDModel - Actions</summary>

#### action: setFeatureDensityStats

Records the span the byte estimate was measured at so the derived
`regionTooLarge` getter can scale it to the current view (mirrors canvas's
setFeatureDensityStats override).

```ts
type setFeatureDensityStats = (stats?: FeatureDensityStats | undefined) => void
```

#### action: setFeatureDensityStatsLimit

Force-load raises the byte gate past the estimate scaled to the _current_ view
(`estimatedVisibleBytes`), not the raw captured bytes. The derived gate compares
against the scaled estimate, so if the view zoomed out between the estimate
capture and the force-load click, raising past the raw bytes would leave the
estimate above the new limit and the banner up. Mirrors canvas's override;
without it the shared RegionTooLargeMixin default (raw bytes) under-raises this
derived, scale-aware path.

```ts
type setFeatureDensityStatsLimit = (
  stats?: { bytes?: number | undefined } | undefined,
) => void
```

#### action: startRenderingBackend

Starts the upload/render autorun. Data + color ramp both derive from the same
rpcData object, so a single identity-diffed slot handles both uploads.

```ts
type startRenderingBackend = (backend: LDRenderingBackend) => void
```

#### action: performLDFetch

Re-fetches LD matrix for the current viewport. Both the autorun (in
`afterAttach`) and `reload()` invoke this directly.

```ts
type performLDFetch = () => Promise<void>
```

</details>

<details>
<summary>SharedLDModel - Actions (other undocumented members)</summary>

#### action: setRpcData

```ts
type setRpcData = (data: LDDataResult | null) => void
```

#### action: setFocalSnp

```ts
type setFocalSnp = (snp: LDSnp | undefined) => void
```

#### action: setLineZoneHeight

```ts
type setLineZoneHeight = (n: number) => void
```

#### action: setMafFilter

```ts
type setMafFilter = (arg: number) => void
```

#### action: setLDMetric

```ts
type setLDMetric = (metric: LDMetric) => void
```

#### action: setShowLegend

```ts
type setShowLegend = (show: boolean) => void
```

#### action: setShowLDTriangle

```ts
type setShowLDTriangle = (show: boolean) => void
```

#### action: setShowRecombination

```ts
type setShowRecombination = (show: boolean) => void
```

#### action: setFitToHeight

```ts
type setFitToHeight = (value: boolean) => void
```

#### action: setHweFilter

```ts
type setHweFilter = (threshold: number) => void
```

#### action: setCallRateFilter

```ts
type setCallRateFilter = (threshold: number) => void
```

#### action: setShowVerticalGuides

```ts
type setShowVerticalGuides = (show: boolean) => void
```

#### action: setShowLabels

```ts
type setShowLabels = (show: boolean) => void
```

#### action: setUseGenomicPositions

```ts
type setUseGenomicPositions = (value: boolean) => void
```

#### action: setSignedLD

```ts
type setSignedLD = (value: boolean) => void
```

#### action: setJexlFilters

```ts
type setJexlFilters = (filters: string[] | undefined) => void
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

#### property: type

```ts
// type signature
type type = ISimpleType<string>
// code
type: types.string
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
<summary>Derived from GlobalDataDisplayMixin</summary>

[GlobalDataDisplayMixin →](../globaldatadisplaymixin)

**Getters**

#### getter: displayPhase

Same precedence as MultiRegionDisplayMixin (single-sourced in
`computeDisplayPhase`). A global display has no per-region staleness axis — it
either has its one dataset or is fetching it — so its `loading` axis is simply
"fetch in flight". Reads `renderError` (RenderLifecycleMixin), which is why it
lives here, not in GlobalFetchMixin.

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

#### action: setLastDrawnViewport

```ts
type setLastDrawnViewport = (offsetPx: number, bpPerPx: number) => void
```

</details>
