---
id: linearhicdisplay
title: LinearHicDisplay
sidebar_label: Display -> LinearHicDisplay
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`hic` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/hic/src/LinearHicDisplay/model.ts).

## Example usage

A complete `HicTrack` config to paste into `tracks`. `resolutionBias` nudges the
auto-picked binsize (negative = finer, positive = coarser):

```js
{
  type: 'HicTrack',
  trackId: 'hic',
  name: 'Hi-C',
  assemblyNames: ['hg38'],
  adapter: { type: 'HicAdapter', uri: 'https://example.com/contacts.hic' },
  displays: [
    {
      type: 'LinearHicDisplay',
      displayId: 'hic-LinearHicDisplay',
      useLogScale: true,
      resolutionBias: 1,
    },
  ],
}
```

## Overview

Hi-C display that renders contact matrix using WebGL

## Members

| Member                                                                 | Kind       | Defined by                                                | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------- | ---------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [type](#property-type)                                                 | Properties | LinearHicDisplay                                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [configuration](#property-configuration)                               | Properties | LinearHicDisplay                                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [rpcData](#volatile-rpcdata)                                           | Volatiles  | LinearHicDisplay                                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [availableNormalizations](#volatile-availablenormalizations)           | Volatiles  | LinearHicDisplay                                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [availableResolutions](#volatile-availableresolutions)                 | Volatiles  | LinearHicDisplay                                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [view](#getter-view)                                                   | Getters    | LinearHicDisplay                                          | the containing LGV, typed once here so downstream getters don't repeat the `getContainingView` cast                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [resolutionBias](#getter-resolutionbias)                               | Getters    | LinearHicDisplay                                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [useLogScale](#getter-uselogscale)                                     | Getters    | LinearHicDisplay                                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [useColorPercentile](#getter-usecolorpercentile)                       | Getters    | LinearHicDisplay                                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [showResolutionControls](#getter-showresolutioncontrols)               | Getters    | LinearHicDisplay                                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [selectedNormalization](#getter-selectednormalization)                 | Getters    | LinearHicDisplay                                          | The user's persisted normalization choice. May name a scheme the current `.hic` file doesn't actually offer — `activeNormalization` resolves that.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [activeNormalization](#getter-activenormalization)                     | Getters    | LinearHicDisplay                                          | The normalization actually used, resolved against what the file offers (`availableNormalizations`). Falls back to the next-best available scheme when the selection is absent (hic-straw silently uses NONE otherwise). A pure getter, so opening a file that lacks the selected scheme never writes a config delta / marks the track edited — only an explicit user pick (setActiveNormalization) does.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [fitToHeight](#getter-fittoheight)                                     | Getters    | LinearHicDisplay                                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [dataLoaded](#getter-dataloaded)                                       | Getters    | LinearHicDisplay                                          | GlobalDataDisplayMixin hook (global-display analog of `viewportWithinLoadedData`): the contact matrix is loaded once `rpcData` is set (the fetch commits it even for an empty viewport) AND that data was fetched for the current viewport. Gating on freshness — not merely `rpcData !== null` — keeps off-screen `svgReady` from resolving on a matrix left over from the pre-pan/zoom viewport during the debounced-refetch window (`setLastDrawnViewport` runs right after `setRpcData`, so the two move together).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [isEmpty](#getter-isempty)                                             | Getters    | LinearHicDisplay                                          | Data has arrived for the current viewport and it is genuinely empty — the file has no contacts here at this resolution (HicAdapter returns `[]` for such a region pair). Lets the UI tell "nothing to show" apart from "still fetching", which otherwise look identical: a blank track.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [colorScheme](#getter-colorscheme)                                     | Getters    | LinearHicDisplay                                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [showLegend](#getter-showlegend)                                       | Getters    | LinearHicDisplay                                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [colorMaxScore](#getter-colormaxscore)                                 | Getters    | LinearHicDisplay                                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [hasLegendData](#getter-haslegenddata)                                 | Getters    | LinearHicDisplay                                          | Whether there's a color scale worth drawing a legend for: data loaded with a positive saturation point. The single place the `colorMaxScore` "0 means nothing to show" sentinel is interpreted — legend consumers read this, not the raw score.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [autoResolutionIdx](#getter-autoresolutionidx)                         | Getters    | LinearHicDisplay                                          | Index into `availableResolutions` that pure auto-mode would pick at the current zoom — largest binsize ≤ 2*bpPerPx, falling back to the finest binsize (idx 0) when nothing qualifies (very zoomed in). The factor 2 floors at ~0.5 bins/screen-pixel, which keeps bins visible without going sub-pixel; users who want finer can step the resolution bias down.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [yScalar](#getter-yscalar)                                             | Getters    | LinearHicDisplay                                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [effectiveResolutionIdx](#getter-effectiveresolutionidx)               | Getters    | LinearHicDisplay                                          | Index actually used after applying `resolutionBias`, clamped to the valid range so a stale bias from a different zoom level can't index out of bounds.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [effectiveResolution](#getter-effectiveresolution)                     | Getters    | LinearHicDisplay                                          | The actual binsize to fetch at, after auto-pick + bias.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [renderTransform](#getter-rendertransform)                             | Getters    | LinearHicDisplay                                          | Forward transform { scale, viewOffsetX } shared by GPU render, mouse hit-test, and SVG export. See `computeRenderTransform` for the math.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [rpcProps](#method-rpcprops)                                           | Methods    | LinearHicDisplay                                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [hitTest](#method-hittest)                                             | Methods    | LinearHicDisplay                                          | Inverse of the render transform: takes mouse coords (canvas-relative) and returns the contact bin under the cursor, or undefined. The forward transform lives in `renderTransform`; this is its inverse so hit-testing always matches what was drawn.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [renderState](#method-renderstate)                                     | Methods    | LinearHicDisplay                                          | Computed per-frame render state for the GPU backend. Read by the autorun lifecycle on every change to any tracked observable.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [svgLegendWidth](#method-svglegendwidth)                               | Methods    | LinearHicDisplay                                          | Width of the SVG legend (consumed by SVGLinearGenomeView). Returns 0 when no legend will be drawn so the export framework can omit space.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [trackMenuItems](#method-trackmenuitems)                               | Methods    | LinearHicDisplay                                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [renderSvg](#method-rendersvg)                                         | Methods    | LinearHicDisplay                                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setRpcData](#action-setrpcdata)                                       | Actions    | LinearHicDisplay                                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [startRenderingBackend](#action-startrenderingbackend)                 | Actions    | LinearHicDisplay                                          | Called by the React hook (`useRenderingBackend`) when the HAL resolves. Wires the backend into the mixin-owned autorun pair via `attachRenderingBackend`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [setUseLogScale](#action-setuselogscale)                               | Actions    | LinearHicDisplay                                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setUseColorPercentile](#action-setusecolorpercentile)                 | Actions    | LinearHicDisplay                                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setShowResolutionControls](#action-setshowresolutioncontrols)         | Actions    | LinearHicDisplay                                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setColorScheme](#action-setcolorscheme)                               | Actions    | LinearHicDisplay                                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setActiveNormalization](#action-setactivenormalization)               | Actions    | LinearHicDisplay                                          | Persist the user's explicit normalization pick. Resolution against what the file offers happens in the `activeNormalization` getter, so this only fires on a real user choice.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [setAvailableNormalizations](#action-setavailablenormalizations)       | Actions    | LinearHicDisplay                                          | Record what the `.hic` file offers. Resolution lives in the `activeNormalization` getter (which falls back off this list when the user's `selectedNormalization` isn't available), so this doesn't write the selection — opening a file that lacks the selected scheme never marks the track edited.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [setFitToHeight](#action-setfittoheight)                               | Actions    | LinearHicDisplay                                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setShowLegend](#action-setshowlegend)                                 | Actions    | LinearHicDisplay                                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setAvailableResolutions](#action-setavailableresolutions)             | Actions    | LinearHicDisplay                                          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [resetResolutionBias](#action-resetresolutionbias)                     | Actions    | LinearHicDisplay                                          | Reset to pure auto-mode: bias 0, binsize follows zoom directly.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setResolution](#action-setresolution)                                 | Actions    | LinearHicDisplay                                          | Lock to a specific binsize (from the overlay dropdown) by converting it to the bias offset from the current auto pick, so the choice still shifts consistently as the user zooms. No-op if the binsize isn't one the file offers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [performHicFetch](#action-performhicfetch)                             | Actions    | LinearHicDisplay                                          | Re-fetches contact matrix for the current viewport. Driven by the `afterAttach` autorun, which also re-fires on `reload()` (it tracks `reloadCounter`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [id](#property-id)                                                     | Properties | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [rpcDriverName](#property-rpcdrivername)                               | Properties | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [ignorePromotedDefaults](#property-ignorepromoteddefaults)             | Properties | [BaseDisplay](../basedisplay)                             | true for a display that arrived inside a session received from someone else (a share link, an encoded/json session, a `spec-` URL). Such a display resolves its `promotable` config slots from its own config only, never from this browser's promoted display-type defaults (see `configuration/promotableDefaults.ts`) — the received session is a record of what the sender saw, and a local preference silently repainting it would make it a lie. A track opened _afterwards_ in that same session is a fresh track of this user's, so it never gets the flag and picks up their defaults normally. Cleared by `resetSlotsToInherit` when the user deliberately makes the display follow a default.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [error](#volatile-error)                                               | Volatiles  | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [statusMessage](#volatile-statusmessage)                               | Volatiles  | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [statusProgress](#volatile-statusprogress)                             | Volatiles  | [BaseDisplay](../basedisplay)                             | determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate. Set alongside `statusMessage` by `setStatusMessage`; a display that never shows a bar simply leaves it undefined.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [parentTrack](#getter-parenttrack)                                     | Getters    | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [parentDisplay](#getter-parentdisplay)                                 | Getters    | [BaseDisplay](../basedisplay)                             | Returns the parent display if this display is nested within another display (e.g., PileupDisplay inside LinearAlignmentsDisplay)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [RenderingComponent](#getter-renderingcomponent)                       | Getters    | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [DisplayBlurb](#getter-displayblurb)                                   | Getters    | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [adapterConfig](#getter-adapterconfig)                                 | Getters    | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [isMinimized](#getter-isminimized)                                     | Getters    | [BaseDisplay](../basedisplay)                             | Returns true if the parent track is minimized. Used to skip expensive operations like autoruns when track is not visible.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [effectiveRpcDriverName](#getter-effectiverpcdrivername)               | Getters    | [BaseDisplay](../basedisplay)                             | Returns the effective RPC driver name with hierarchical fallback: 1. This display's explicit rpcDriverName 2. Parent display's effectiveRpcDriverName (for nested displays) 3. Track config's rpcDriverName                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [DisplayMessageComponent](#getter-displaymessagecomponent)             | Getters    | [BaseDisplay](../basedisplay)                             | if a display-level message should be displayed instead, make this return a react component                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [renderingProps](#method-renderingprops)                               | Methods    | [BaseDisplay](../basedisplay)                             | props passed to the renderer's React "Rendering" component. these are client-side only and never sent to the worker. includes displayModel and callbacks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [regionCannotBeRendered](#method-regioncannotberendered)               | Methods    | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setIgnorePromotedDefaults](#action-setignorepromoteddefaults)         | Actions    | [BaseDisplay](../basedisplay)                             | see the `ignorePromotedDefaults` property                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [setStatusMessage](#action-setstatusmessage)                           | Actions    | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setError](#action-seterror)                                           | Actions    | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setRpcDriverName](#action-setrpcdrivername)                           | Actions    | [BaseDisplay](../basedisplay)                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [reload](#action-reload)                                               | Actions    | [BaseDisplay](../basedisplay)                             | base display reload does nothing, see specialized displays for details                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [scrollTop](#volatile-scrolltop)                                       | Volatiles  | [TrackHeightMixin](../trackheightmixin)                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [height](#getter-height)                                               | Getters    | [TrackHeightMixin](../trackheightmixin)                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setScrollTop](#action-setscrolltop)                                   | Actions    | [TrackHeightMixin](../trackheightmixin)                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setHeight](#action-setheight)                                         | Actions    | [TrackHeightMixin](../trackheightmixin)                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [resizeHeight](#action-resizeheight)                                   | Actions    | [TrackHeightMixin](../trackheightmixin)                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [rendersCanvas](#getter-renderscanvas)                                 | Getters    | [GlobalDataDisplayMixin](../globaldatadisplaymixin)       | Whether this display paints a canvas in its current configuration. Default true. Gates the pre-first-paint term of `displayPhase` below (`rendersCanvas && !canvasDrawn`), so a display that can be toggled to show a static non-canvas placeholder instead (LD with `showLDTriangle` off renders an EmptyState, never a canvas) overrides this to false in that state — otherwise the scrim would sit permanently over the placeholder, since `canvasDrawn` never flips without a canvas. Why this is a hook and not inlined away: the pre-paint scrim decision needs TWO facts — "nothing painted yet" (`!canvasDrawn`, on the model) AND "this isn't a deliberate empty placeholder" — and only the display knows the second. The alternative (render the placeholder OUTSIDE `DisplayChrome` so there's no scrim to gate) was considered and rejected: it would dispose/re-init the GPU backend on every toggle and move a render path out of the shared chrome (see ADR-026). So the hook is irreducible given LD's design — a future reader tempted to delete this "single-override" getter must first move LD's EmptyState, or the scrim regresses over the placeholder. Default lives here so the common case (HiC, always a canvas) needs no override. |
| [displayPhase](#getter-displayphase)                                   | Getters    | [GlobalDataDisplayMixin](../globaldatadisplaymixin)       | Same precedence as MultiRegionDisplayMixin (single-sourced in `computeDisplayPhase`). A global display has no per-region staleness axis, but it does have a pre-first-paint window: between component mount and `isLoading` flipping true (on HiC that means the `CoreGetInfo` round-trip its first fetch waits on). Mirror MultiRegion's `!isReady` term with `!canvasDrawn` so the loading scrim shows immediately on open instead of after that gap — gated by `rendersCanvas` so a display showing a static non-canvas placeholder isn't stuck under it. Once painted, `canvasDrawn` stays true through viewport/setting changes (StaleViewportRescaleMixin keeps the last frame up during refetch), so this adds no scrim on pan or zoom — those keep the existing `isLoading` behavior. Reads `renderError` (RenderLifecycleMixin), which is why it lives here, not in GlobalFetchMixin.                                                                                                                                                                                                                                                                                                                                                                  |
| [reloadCounter](#volatile-reloadcounter)                               | Volatiles  | [GlobalFetchMixin](../globalfetchmixin)                   | Bumped by `reload()` to retrigger a global display's fetch autorun. Each display reads `void self.reloadCounter` in its `afterAttach` fetch autorun so a user-initiated reload re-runs the fetch even when no viewport/setting changed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [svgReadyExtraTerminal](#getter-svgreadyextraterminal)                 | Getters    | [GlobalFetchMixin](../globalfetchmixin)                   | Overridable hook (default false): a subclass returns true to mark an extra terminal state where off-screen export can proceed with no loaded data (mirrors `MultiRegionDisplayMixin.svgReadyExtraTerminal`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [svgReady](#getter-svgready)                                           | Getters    | [GlobalFetchMixin](../globalfetchmixin)                   | Global-display analog of `MultiRegionDisplayMixin.svgReady`: true once an off-screen (SVG) export can read final data. Like that mixin it requires the dataset to actually be loaded (or a terminal error / too-large / extra state), NOT merely "not currently fetching": the fetch trigger is a debounced `afterAttach` autorun, so at export time `isLoading` can still be false with no data yet — a `displayPhase !== 'loading'` test would then capture an empty render. Never gates on `canvasDrawn`, which an off-screen export never sets. Off-screen renderers gate on it via `awaitSvgReady(model)`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [userByteSizeLimit](#volatile-userbytesizelimit)                       | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)             | user-confirmed byte limit after a force-load, disabling the gate. Volatile, not persisted: the interactive force-load button is a transient "show me this now" action and must not leak a raised gate into a saved or shared session. The declarative, session-scoped escape hatch is instead the `forceLoad` config slot (set per-session via a session spec, or baked into a track config for embedded/notebook views).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [featureDensityStats](#volatile-featuredensitystats)                   | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [byteEstimateVisibleBp](#volatile-byteestimatevisiblebp)               | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)             | visibleBp at which the current `featureDensityStats` byte estimate was captured, so the derived gate (`estimatedVisibleBytes`) can scale it to the current view. Written by `setFeatureDensityStats`; ignored unless `derivedRegionTooLargeEnabled`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [derivedRegionTooLargeEnabled](#getter-derivedregiontoolargeenabled)   | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)             | Opt-in switch: a byte-gated display flips this true to enable the derived, self-releasing region-too-large gate. Default false means the display never gates on size (`regionTooLarge` is always false), so non-byte displays (wiggle, manhattan, sequence, synteny, …) don't evaluate the LGV-only `tooLargeStatus` getters at all.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [configuredFetchSizeLimit](#getter-configuredfetchsizelimit)           | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)             | The composing display's configured `fetchSizeLimit`, read straight from its config. Only evaluated when the derived gate is enabled (guarded by `derivedRegionTooLargeEnabled`), and every derived display extends `baseLinearDisplayConfigSchema`, which owns the slot — so the read is always valid where it fires. A display with a bespoke source can still override it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [densityTooLargeForDerivedGate](#getter-densitytoolargeforderivedgate) | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)             | Extra (non-byte) too-large axis folded into the derived verdict — canvas overrides it with its feature-density gate. Byte-only derived displays leave it false.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [configForceLoad](#getter-configforceload)                             | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)             | Declarative force-load: when true the display always renders regardless of region size / feature density (the config-driven equivalent of the force-load button). Read straight from the `forceLoad` config slot on `baseLinearDisplayConfigSchema` (same guard/ownership as `configuredFetchSizeLimit`), so every opt-in display honors it without per-display wiring.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [estimatedVisibleBytes](#getter-estimatedvisiblebytes)                 | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)             | The cached byte estimate scaled from the span it was measured over (`byteEstimateVisibleBp`) to the currently visible span. Roughly proportional to span, so scaling makes the derived verdict a pure function of the current view and self-releases on zoom-in — without it a large zoomed-out estimate stays above the limit forever and gates refetch. Only meaningful when `derivedRegionTooLargeEnabled`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [tooLargeStatus](#getter-toolargestatus)                               | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)             | Shared derived verdict + reason (AUTO_FORCE_LOAD_BP floor, then bytes-over-limit, then the density axis), fed the scaled estimate so the byte gate self-releases on zoom-in. Same helper as every other gating path so the banner text can't drift.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [regionTooLarge](#getter-regiontoolarge)                               | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [regionTooLargeReason](#getter-regiontoolargereason)                   | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [regionCannotBeRenderedText](#method-regioncannotberenderedtext)       | Methods    | [RegionTooLargeMixin](../regiontoolargemixin)             | Plaintext reason (for SVG export); the on-screen too-large UI is rendered by the display chrome via `TooLargeMessage`, not the model.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [setFeatureDensityStats](#action-setfeaturedensitystats)               | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)             | Commits the byte estimate and records the span it was measured at (`byteEstimateVisibleBp`) so the derived gate can scale it to the current view. The capture is harmless for non-gated displays (they ignore it).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setFeatureDensityStatsLimit](#action-setfeaturedensitystatslimit)     | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)             | force-load: raise the byte limit past the current request so the gate releases. Raises past the estimate scaled to the _current_ view (not the raw captured bytes), so it clears even if the view zoomed out after the estimate was captured; `raiseLimitPast` is the raw fallback for a display with no scaled estimate. Canvas (which also has a density force-load) overrides this entirely.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [forceLoad](#action-forceload)                                         | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)             | Raises the byte limit past the current density stats and triggers a reload. The display chrome calls this via TooLargeMessage's force-load button; concrete display models override reload() to do the actual refetch.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [activeStopToken](#volatile-activestoptoken)                           | Volatiles  | [FetchMixin](../fetchmixin)                               | stop token of the in-flight fetch, or undefined when idle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [fetchGeneration](#volatile-fetchgeneration)                           | Volatiles  | [FetchMixin](../fetchmixin)                               | bumps at every fetch end; autoruns read it to re-evaluate, and it doubles as the staleness epoch inside runFetch                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [fetchCanceled](#volatile-fetchcanceled)                               | Volatiles  | [FetchMixin](../fetchmixin)                               | true after the user explicitly cancels a load (the loading overlay's cancel button → `cancelFetchByUser`). A durable, blocking state — unlike `cancelFetch`, it does not retrigger the fetch autoruns — so the load stays stopped until the user retries (`reload`) or the viewport changes. Any new fetch clears it (`runFetch` resets it at the start).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [regionStatuses](#volatile-regionstatuses)                             | Volatiles  | [FetchMixin](../fetchmixin)                               | latest status of each concurrent in-flight operation, keyed by an arbitrary id (the canvas display uses displayedRegionIndex). Plain bookkeeping — not read reactively; setRegionStatus derives the observable statusMessage/statusProgress from it on every update so N parallel region fetches aggregate into one bar instead of clobbering.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [lastStatusMs](#volatile-laststatusms)                                 | Volatiles  | [FetchMixin](../fetchmixin)                               | Date.now() of the last applied status write; the status callbacks gate on it to throttle a high-frequency progress stream.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [isLoading](#getter-isloading)                                         | Getters    | [FetchMixin](../fetchmixin)                               | true while a fetch is active                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [makeStatusCallback](#method-makestatuscallback)                       | Methods    | [FetchMixin](../fetchmixin)                               | An RPC `statusCallback` bound to this display: forwards progress to the shared `statusMessage`, guarded by `isAlive` so a callback that fires after the node is torn down (RPCs resolve their status stream asynchronously) is a safe no-op. Pass directly as the `statusCallback` RPC arg instead of re-inlining the guard at every call site.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [makeRegionStatusCallback](#method-makeregionstatuscallback)           | Methods    | [FetchMixin](../fetchmixin)                               | Per-region variant of `makeStatusCallback`: routes progress through `setRegionStatus(key, …)` so N concurrent per-region fetches aggregate into one status bar instead of clobbering each other. Same `isAlive` guard.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [throttleStatus](#action-throttlestatus)                               | Actions    | [FetchMixin](../fetchmixin)                               | Run `apply` only if at least `STATUS_THROTTLE_MS` has passed since the last status write. A leading-edge throttle: sparse updates pass straight through, dense progress bursts are thinned so the loading overlay stops re-rendering faster than the view animates. The final status doesn't need a trailing flush — fetch completion clears it via `resetStatus`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [resetStatus](#action-resetstatus)                                     | Actions    | [FetchMixin](../fetchmixin)                               | Drop the active stop token and clear all status bookkeeping. Shared by both cancel paths and runFetch's cleanup.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [stopActiveFetch](#action-stopactivefetch)                             | Actions    | [FetchMixin](../fetchmixin)                               | Abort the in-flight fetch (if any) and clear its status. The shared preamble of both cancel paths; the difference between them is only what they do to `fetchCanceled` / `fetchGeneration` afterward.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [setRegionStatus](#action-setregionstatus)                             | Actions    | [FetchMixin](../fetchmixin)                               | Record one concurrent operation's latest status (keyed) and recompute the shared statusMessage/statusProgress as the aggregate across all in-flight keys. Pass undefined to drop a key. Used by displays that fan a single fetch out into parallel per-region RPCs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [cancelFetch](#action-cancelfetch)                                     | Actions    | [FetchMixin](../fetchmixin)                               | cancel any in-flight fetch and bump fetchGeneration (always bumps, so callers can retrigger fetch autoruns even when nothing was in flight). This is the _internal_ reset used by clearAllRpcData/invalidateLoadedRegions — it clears any user-cancel flag so the retrigger actually re-fetches.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [cancelFetchByUser](#action-cancelfetchbyuser)                         | Actions    | [FetchMixin](../fetchmixin)                               | User-initiated cancel from the loading overlay. Stops the in-flight fetch and lands in a durable `fetchCanceled` state. Unlike `cancelFetch`, it does NOT bump fetchGeneration — so the fetch autoruns don't immediately restart the load. The user retries via `reload` (the overlay's retry button), or it clears on the next viewport change.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [beforeDestroy](#action-beforedestroy)                                 | Actions    | [FetchMixin](../fetchmixin)                               | Release an in-flight fetch's stop token on teardown. Without this, a display destroyed mid-fetch (track/view closed while loading) never revokes its token — a blob-URL leak on the non-SAB fallback path — and never signals the worker to abort the now-useless work. MST auto-chains lifecycle hooks, so a composing display can still define its own beforeDestroy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [runFetch](#action-runfetch)                                           | Actions    | [FetchMixin](../fetchmixin)                               | Run a cancel-safe fetch (cancels any prior). The work callback gets a FetchContext with a stopToken to forward to the RPC and an isStale() check to short-circuit commits once the user has moved on. Abort errors are swallowed; others are stored in `error` if not stale.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [canvasDrawn](#volatile-canvasdrawn)                                   | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)           | flips true on first paint; read by test selectors to detect render                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [currentRenderingBackend](#volatile-currentrenderingbackend)           | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)           | current backend reference, updated on context-loss recovery. Typed `unknown` (not generic `B`) on purpose: this mixin is composed by every display via a non-generic factory, so the per-display backend type `B` isn't known here — it's supplied at `attachRenderingBackend<B>` and narrowed with `as B` inside the autoruns. Don't "fix" the cast.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [renderTick](#volatile-rendertick)                                     | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)           | counter the render autorun observes; bumped to force a re-render                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [autorunsInstalled](#volatile-autorunsinstalled)                       | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)           | guards attachRenderingBackend so the autorun pair spawns once per instance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [renderError](#volatile-rendererror)                                   | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)           | the render-backend (GPU/Canvas2D init or context-loss) error, or undefined. Single source of truth for the render-error terminal state: `useRenderingBackend` writes it from the canvas-init mechanism so the model — not React-local hook state — owns every terminal state. Read by `displayPhase` (whose `renderError` term outranks `loading`, suppressing the scrim) and by `DisplayChrome` (shows the retry overlay).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [markCanvasDrawn](#action-markcanvasdrawn)                             | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)           |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [resetCanvasDrawn](#action-resetcanvasdrawn)                           | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)           |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [stopRenderingBackend](#action-stoprenderingbackend)                   | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)           |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [renderNow](#action-rendernow)                                         | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)           |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setRenderError](#action-setrendererror)                               | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)           | set/clear the render-backend error. Called by `useRenderingBackend`: with the error when the canvas factory rejects (or context-loss re-init fails), and with `undefined` on successful (re)init and on retry.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [attachRenderingBackend](#action-attachrenderingbackend)               | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)           | attach a GPU/Canvas2D backend and install the upload + render autorun pair (idempotent — re-calling only swaps the backend)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [lastDrawnOffsetPx](#volatile-lastdrawnoffsetpx)                       | Volatiles  | [StaleViewportRescaleMixin](../staleviewportrescalemixin) | offsetPx of the viewport when the canvas was last fully drawn                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [lastDrawnBpPerPx](#volatile-lastdrawnbpperpx)                         | Volatiles  | [StaleViewportRescaleMixin](../staleviewportrescalemixin) | bpPerPx of the viewport when the canvas was last fully drawn                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [setLastDrawnViewport](#action-setlastdrawnviewport)                   | Actions    | [StaleViewportRescaleMixin](../staleviewportrescalemixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

### LinearHicDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/linearhicdisplay).

<details>
<summary>LinearHicDisplay - Properties</summary>

#### property: type

```ts
// type signature
type type = ISimpleType<'LinearHicDisplay'>
// code
type: types.literal('LinearHicDisplay')
```

#### property: configuration

```ts
// type signature
type configuration = IConfigurationReference<ConfigurationSchemaType<{ readonly height: { readonly type: "number"; readonly defaultValue: 300; readonly description: "default height for the Hi-C track"; }; readonly colorScheme: { readonly type: "stringEnum"; readonly model: ISimpleType<...>; readonly defaultValue: "juicebox"; readonly de...
// code
configuration: ConfigurationReference(configSchema)
```

</details>

<details>
<summary>LinearHicDisplay - Volatiles</summary>

#### volatile: rpcData

```ts
// type signature
type rpcData = HicDataResult | null
// code
rpcData: null as HicDataResult | null
```

#### volatile: availableNormalizations

```ts
// type signature
type availableNormalizations = string[] | undefined
// code
availableNormalizations: undefined as string[] | undefined
```

#### volatile: availableResolutions

```ts
// type signature
type availableResolutions = number[] | undefined
// code
availableResolutions: undefined as number[] | undefined
```

</details>

<details>
<summary>LinearHicDisplay - Getters</summary>

#### getter: view

the containing LGV, typed once here so downstream getters don't repeat the
`getContainingView` cast

```ts
type view = ModelInstanceTypeProps<_OverrideProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>, { ...; }>> & ... 21 more ... & IStateTreeNode<...>
```

#### getter: selectedNormalization

The user's persisted normalization choice. May name a scheme the current `.hic`
file doesn't actually offer — `activeNormalization` resolves that.

```ts
type selectedNormalization = string
```

#### getter: activeNormalization

The normalization actually used, resolved against what the file offers
(`availableNormalizations`). Falls back to the next-best available scheme when
the selection is absent (hic-straw silently uses NONE otherwise). A pure getter,
so opening a file that lacks the selected scheme never writes a config delta /
marks the track edited — only an explicit user pick (setActiveNormalization)
does.

```ts
type activeNormalization = string
```

#### getter: dataLoaded

GlobalDataDisplayMixin hook (global-display analog of
`viewportWithinLoadedData`): the contact matrix is loaded once `rpcData` is set
(the fetch commits it even for an empty viewport) AND that data was fetched for
the current viewport. Gating on freshness — not merely `rpcData !== null` —
keeps off-screen `svgReady` from resolving on a matrix left over from the
pre-pan/zoom viewport during the debounced-refetch window
(`setLastDrawnViewport` runs right after `setRpcData`, so the two move
together).

```ts
type dataLoaded = boolean
```

#### getter: isEmpty

Data has arrived for the current viewport and it is genuinely empty — the file
has no contacts here at this resolution (HicAdapter returns `[]` for such a
region pair). Lets the UI tell "nothing to show" apart from "still fetching",
which otherwise look identical: a blank track.

```ts
type isEmpty = boolean
```

#### getter: hasLegendData

Whether there's a color scale worth drawing a legend for: data loaded with a
positive saturation point. The single place the `colorMaxScore` "0 means nothing
to show" sentinel is interpreted — legend consumers read this, not the raw
score.

```ts
type hasLegendData = boolean
```

#### getter: autoResolutionIdx

Index into `availableResolutions` that pure auto-mode would pick at the current
zoom — largest binsize ≤ 2*bpPerPx, falling back to the finest binsize (idx 0)
when nothing qualifies (very zoomed in).

The factor 2 floors at ~0.5 bins/screen-pixel, which keeps bins visible without
going sub-pixel; users who want finer can step the resolution bias down.

```ts
type autoResolutionIdx = number
```

#### getter: effectiveResolutionIdx

Index actually used after applying `resolutionBias`, clamped to the valid range
so a stale bias from a different zoom level can't index out of bounds.

```ts
type effectiveResolutionIdx = number
```

#### getter: effectiveResolution

The actual binsize to fetch at, after auto-pick + bias.

```ts
type effectiveResolution = number | undefined
```

#### getter: renderTransform

Forward transform { scale, viewOffsetX } shared by GPU render, mouse hit-test,
and SVG export. See `computeRenderTransform` for the math.

```ts
type renderTransform = RenderTransform
```

</details>

<details>
<summary>LinearHicDisplay - Getters (other undocumented members)</summary>

#### getter: resolutionBias

```ts
type resolutionBias = number
```

#### getter: useLogScale

```ts
type useLogScale = boolean
```

#### getter: useColorPercentile

```ts
type useColorPercentile = boolean
```

#### getter: showResolutionControls

```ts
type showResolutionControls = boolean
```

#### getter: fitToHeight

```ts
type fitToHeight = boolean
```

#### getter: colorScheme

```ts
type colorScheme = 'fall' | 'juicebox' | 'viridis'
```

#### getter: showLegend

```ts
type showLegend = boolean
```

#### getter: colorMaxScore

```ts
type colorMaxScore = number
```

#### getter: yScalar

```ts
type yScalar = number
```

</details>

<details>
<summary>LinearHicDisplay - Methods</summary>

#### method: hitTest

Inverse of the render transform: takes mouse coords (canvas-relative) and
returns the contact bin under the cursor, or undefined. The forward transform
lives in `renderTransform`; this is its inverse so hit-testing always matches
what was drawn.

```ts
type hitTest = (mouseX: number, mouseY: number) => HicContactItem | undefined
```

#### method: renderState

Computed per-frame render state for the GPU backend. Read by the autorun
lifecycle on every change to any tracked observable.

```ts
type renderState =
  | {
      binWidth: number
      yScalar: number
      canvasWidth: number
      canvasHeight: number
      colorMaxScore: number
      useLogScale: boolean
      viewScale: number
      viewOffsetX: number
    }
  | undefined
```

#### method: svgLegendWidth

Width of the SVG legend (consumed by SVGLinearGenomeView). Returns 0 when no
legend will be drawn so the export framework can omit space.

```ts
type svgLegendWidth = () => number
```

</details>

<details>
<summary>LinearHicDisplay - Methods (other undocumented members)</summary>

#### method: rpcProps

```ts
type rpcProps = () => { normalization: string }
```

#### method: trackMenuItems

```ts
type trackMenuItems = () => MenuItem[]
```

#### method: renderSvg

```ts
type renderSvg = (opts: ExportSvgDisplayOptions) => Promise<ReactNode>
```

</details>

<details>
<summary>LinearHicDisplay - Actions</summary>

#### action: startRenderingBackend

Called by the React hook (`useRenderingBackend`) when the HAL resolves. Wires
the backend into the mixin-owned autorun pair via `attachRenderingBackend`.

```ts
type startRenderingBackend = (backend: HicRenderingBackend) => void
```

#### action: setActiveNormalization

Persist the user's explicit normalization pick. Resolution against what the file
offers happens in the `activeNormalization` getter, so this only fires on a real
user choice.

```ts
type setActiveNormalization = (f: string) => void
```

#### action: setAvailableNormalizations

Record what the `.hic` file offers. Resolution lives in the
`activeNormalization` getter (which falls back off this list when the user's
`selectedNormalization` isn't available), so this doesn't write the selection —
opening a file that lacks the selected scheme never marks the track edited.

```ts
type setAvailableNormalizations = (f: string[]) => void
```

#### action: resetResolutionBias

Reset to pure auto-mode: bias 0, binsize follows zoom directly.

```ts
type resetResolutionBias = () => void
```

#### action: setResolution

Lock to a specific binsize (from the overlay dropdown) by converting it to the
bias offset from the current auto pick, so the choice still shifts consistently
as the user zooms. No-op if the binsize isn't one the file offers.

```ts
type setResolution = (binSize: number) => void
```

#### action: performHicFetch

Re-fetches contact matrix for the current viewport. Driven by the `afterAttach`
autorun, which also re-fires on `reload()` (it tracks `reloadCounter`).

```ts
type performHicFetch = () => Promise<void>
```

</details>

<details>
<summary>LinearHicDisplay - Actions (other undocumented members)</summary>

#### action: setRpcData

```ts
type setRpcData = (data: HicDataResult | null) => void
```

#### action: setUseLogScale

```ts
type setUseLogScale = (f: boolean) => void
```

#### action: setUseColorPercentile

```ts
type setUseColorPercentile = (f: boolean) => void
```

#### action: setShowResolutionControls

```ts
type setShowResolutionControls = (f: boolean) => void
```

#### action: setColorScheme

```ts
type setColorScheme = (f?: 'fall' | 'juicebox' | 'viridis' | undefined) => void
```

#### action: setFitToHeight

```ts
type setFitToHeight = (arg: boolean) => void
```

#### action: setShowLegend

```ts
type setShowLegend = (arg: boolean) => void
```

#### action: setAvailableResolutions

```ts
type setAvailableResolutions = (f: number[]) => void
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
<summary>Derived from GlobalDataDisplayMixin</summary>

[GlobalDataDisplayMixin →](../globaldatadisplaymixin)

**Getters**

#### getter: rendersCanvas

Whether this display paints a canvas in its current configuration. Default true.
Gates the pre-first-paint term of `displayPhase` below
(`rendersCanvas && !canvasDrawn`), so a display that can be toggled to show a
static non-canvas placeholder instead (LD with `showLDTriangle` off renders an
EmptyState, never a canvas) overrides this to false in that state — otherwise
the scrim would sit permanently over the placeholder, since `canvasDrawn` never
flips without a canvas.

Why this is a hook and not inlined away: the pre-paint scrim decision needs TWO
facts — "nothing painted yet" (`!canvasDrawn`, on the model) AND "this isn't a
deliberate empty placeholder" — and only the display knows the second. The
alternative (render the placeholder OUTSIDE `DisplayChrome` so there's no scrim
to gate) was considered and rejected: it would dispose/re-init the GPU backend
on every toggle and move a render path out of the shared chrome (see ADR-026).
So the hook is irreducible given LD's design — a future reader tempted to delete
this "single-override" getter must first move LD's EmptyState, or the scrim
regresses over the placeholder. Default lives here so the common case (HiC,
always a canvas) needs no override.

```ts
type rendersCanvas = boolean
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

#### volatile: userByteSizeLimit

user-confirmed byte limit after a force-load, disabling the gate. Volatile, not
persisted: the interactive force-load button is a transient "show me this now"
action and must not leak a raised gate into a saved or shared session. The
declarative, session-scoped escape hatch is instead the `forceLoad` config slot
(set per-session via a session spec, or baked into a track config for
embedded/notebook views).

```ts
// type signature
type userByteSizeLimit = number | undefined
// code
userByteSizeLimit: undefined as number | undefined
```

#### volatile: featureDensityStats

```ts
// type signature
type featureDensityStats = FeatureDensityStats | undefined
// code
featureDensityStats: undefined as FeatureDensityStats | undefined
```

#### volatile: byteEstimateVisibleBp

visibleBp at which the current `featureDensityStats` byte estimate was captured,
so the derived gate (`estimatedVisibleBytes`) can scale it to the current view.
Written by `setFeatureDensityStats`; ignored unless
`derivedRegionTooLargeEnabled`.

```ts
// type signature
type byteEstimateVisibleBp = number | undefined
// code
byteEstimateVisibleBp: undefined as number | undefined
```

**Getters**

#### getter: derivedRegionTooLargeEnabled

Opt-in switch: a byte-gated display flips this true to enable the derived,
self-releasing region-too-large gate. Default false means the display never
gates on size (`regionTooLarge` is always false), so non-byte displays (wiggle,
manhattan, sequence, synteny, …) don't evaluate the LGV-only `tooLargeStatus`
getters at all.

```ts
type derivedRegionTooLargeEnabled = boolean
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

#### getter: estimatedVisibleBytes

The cached byte estimate scaled from the span it was measured over
(`byteEstimateVisibleBp`) to the currently visible span. Roughly proportional to
span, so scaling makes the derived verdict a pure function of the current view
and self-releases on zoom-in — without it a large zoomed-out estimate stays
above the limit forever and gates refetch. Only meaningful when
`derivedRegionTooLargeEnabled`.

```ts
type estimatedVisibleBytes = number | undefined
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

#### action: setFeatureDensityStats

Commits the byte estimate and records the span it was measured at
(`byteEstimateVisibleBp`) so the derived gate can scale it to the current view.
The capture is harmless for non-gated displays (they ignore it).

```ts
type setFeatureDensityStats = (stats?: FeatureDensityStats | undefined) => void
```

#### action: setFeatureDensityStatsLimit

force-load: raise the byte limit past the current request so the gate releases.
Raises past the estimate scaled to the _current_ view (not the raw captured
bytes), so it clears even if the view zoomed out after the estimate was
captured; `raiseLimitPast` is the raw fallback for a display with no scaled
estimate. Canvas (which also has a density force-load) overrides this entirely.

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
