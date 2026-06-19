---
id: globaldatadisplaymixin
title: GlobalDataDisplayMixin
sidebar_label: Mixin -> GlobalDataDisplayMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/BaseLinearDisplay/models/GlobalDataDisplayMixin.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/GlobalDataDisplayMixin.md)

## Overview

Mixin for GPU displays that hold a single global (non-regional) dataset — HiC
contact matrix, LD triangle, variant matrix, etc.

Composes:

- RenderLifecycleMixin (attachRenderingBackend, renderNow, …)
- RegionTooLargeMixin (regionTooLarge, regionCannotBeRendered, …)
- FetchMixin (runFetch, cancelFetch, isLoading, error, statusMessage,
  fetchGeneration)

Unlike MultiRegionDisplayMixin, this mixin owns no per-region state and installs
no autoruns. Fetch triggering is left entirely to the display's own afterAttach
autorun so each display can express its own trigger conditions (HiC: viewport
change; LD: viewport + showLDTriangle + etc).

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [RegionTooLargeMixin](../regiontoolargemixin)

**Properties:**
[userByteSizeLimit](../regiontoolargemixin#property-userbytesizelimit)

**Volatiles:**
[regionTooLargeState](../regiontoolargemixin#volatile-regiontoolargestate),
[regionTooLargeReasonState](../regiontoolargemixin#volatile-regiontoolargereasonstate),
[featureDensityStats](../regiontoolargemixin#volatile-featuredensitystats)

**Getters:** [regionTooLarge](../regiontoolargemixin#getter-regiontoolarge),
[regionTooLargeReason](../regiontoolargemixin#getter-regiontoolargereason)

**Methods:**
[regionCannotBeRenderedText](../regiontoolargemixin#method-regioncannotberenderedtext)

**Actions:**
[setRegionTooLarge](../regiontoolargemixin#action-setregiontoolarge),
[setFeatureDensityStats](../regiontoolargemixin#action-setfeaturedensitystats),
[setFeatureDensityStatsLimit](../regiontoolargemixin#action-setfeaturedensitystatslimit),
[reload](../regiontoolargemixin#action-reload),
[forceLoad](../regiontoolargemixin#action-forceload)

### Available via [RenderLifecycleMixin](../renderlifecyclemixin)

**Volatiles:** [canvasDrawn](../renderlifecyclemixin#volatile-canvasdrawn),
[currentRenderingBackend](../renderlifecyclemixin#volatile-currentrenderingbackend),
[renderTick](../renderlifecyclemixin#volatile-rendertick),
[autorunsInstalled](../renderlifecyclemixin#volatile-autorunsinstalled),
[renderError](../renderlifecyclemixin#volatile-rendererror)

**Actions:** [markCanvasDrawn](../renderlifecyclemixin#action-markcanvasdrawn),
[resetCanvasDrawn](../renderlifecyclemixin#action-resetcanvasdrawn),
[stopRenderingBackend](../renderlifecyclemixin#action-stoprenderingbackend),
[renderNow](../renderlifecyclemixin#action-rendernow),
[setRenderError](../renderlifecyclemixin#action-setrendererror),
[attachRenderingBackend](../renderlifecyclemixin#action-attachrenderingbackend)

### Available via [FetchMixin](../fetchmixin)

**Volatiles:** [activeStopToken](../fetchmixin#volatile-activestoptoken),
[fetchGeneration](../fetchmixin#volatile-fetchgeneration),
[error](../fetchmixin#volatile-error),
[statusMessage](../fetchmixin#volatile-statusmessage),
[statusProgress](../fetchmixin#volatile-statusprogress),
[fetchCanceled](../fetchmixin#volatile-fetchcanceled),
[regionStatuses](../fetchmixin#volatile-regionstatuses)

**Getters:** [isLoading](../fetchmixin#getter-isloading)

**Actions:** [setError](../fetchmixin#action-seterror),
[setStatusMessage](../fetchmixin#action-setstatusmessage),
[setRegionStatus](../fetchmixin#action-setregionstatus),
[cancelFetch](../fetchmixin#action-cancelfetch),
[cancelFetchByUser](../fetchmixin#action-cancelfetchbyuser),
[runFetch](../fetchmixin#action-runfetch)

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">GlobalDataDisplayMixin - Getters</summary>

#### getter: displayPhase

Same precedence as MultiRegionDisplayMixin (single-sourced in
`computeDisplayPhase`). A global display has no per-region staleness axis — it
either has its one dataset or is fetching it — so its `loading` axis is simply
"fetch in flight".

```js
// type
DisplayPhase
```

#### getter: loadingOverlayVisible

Shared with MultiRegionDisplayMixin's getter of the same name so
`DisplayLoadingOverlay` reads one signal across all GPU displays. Correctly
stays hidden over a display that's intentionally empty (e.g. LD with the
triangle toggled off, which fetches nothing). Separate `.views` block so it can
read the sibling `displayPhase` getter.

```js
// type
boolean
```

#### getter: svgReady

Global-display analog of `MultiRegionDisplayMixin.svgReady`: true once an
off-screen (SVG) export can read final data. A global display has no per-region
spatial axis, so "settled" is simply `displayPhase !== 'loading'` — it has its
one dataset, is in a terminal state (error / tooLarge), or is intentionally
empty. This waits out an in-place refetch (which keeps stale `rpcData` until the
new result commits) and, unlike `isReady`, never gates on `canvasDrawn`, which
an off-screen export never sets. Off-screen renderers gate on it via
`awaitSvgReady(model)` instead of inlining a `data != null || error || ...`
condition.

```js
// type
boolean
```

</details>
