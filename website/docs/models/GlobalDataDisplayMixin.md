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

**Properties:** userByteSizeLimit

**Volatiles:** regionTooLargeState, regionTooLargeReasonState,
featureDensityStats

**Getters:** regionTooLarge, regionTooLargeReason

**Methods:** regionCannotBeRenderedText

**Actions:** setRegionTooLarge, setFeatureDensityStats,
setFeatureDensityStatsLimit, reload, forceLoad

### Available via [RenderLifecycleMixin](../renderlifecyclemixin)

**Volatiles:** canvasDrawn, currentRenderingBackend, renderTick,
autorunsInstalled, renderError

**Actions:** markCanvasDrawn, resetCanvasDrawn, stopRenderingBackend, renderNow,
setRenderError, attachRenderingBackend

### Available via [FetchMixin](../fetchmixin)

**Volatiles:** activeStopToken, fetchGeneration, error, statusMessage,
statusProgress, regionStatuses

**Getters:** isLoading

**Actions:** setError, setStatusMessage, setRegionStatus, cancelFetch, runFetch

### GlobalDataDisplayMixin - Getters

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
