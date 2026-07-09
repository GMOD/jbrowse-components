---
id: globaldatadisplaymixin
title: GlobalDataDisplayMixin
sidebar_label: Mixin -> GlobalDataDisplayMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`linear-genome-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/BaseLinearDisplay/models/GlobalDataDisplayMixin.ts).

## Overview

Mixin for GPU displays that hold a single global (non-regional) dataset — HiC
contact matrix, LD triangle, variant matrix, etc.

Composes:

- RenderLifecycleMixin (attachRenderingBackend, renderNow, …)
- RegionTooLargeMixin (regionTooLarge, regionCannotBeRendered, …)
- FetchMixin (runFetch, cancelFetch, isLoading, error, statusMessage,
  fetchGeneration)

Unlike MultiRegionDisplayMixin, this mixin owns no per-region state and installs
no autoruns. Fetch triggering is left to the display's own afterAttach autorun
so each display can express its own trigger conditions (HiC: viewport change;
LD: viewport + showLDTriangle + etc). The shared skeleton of that autorun lives
in `installGlobalFetchAutorun` (below) — a display supplies only its own
`shouldFetch` gate + `fetch` action.

## Members

| Member                                                 | Kind      | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [reloadCounter](#volatile-reloadcounter)               | Volatiles | Bumped by `reload()` to retrigger a global display's fetch autorun. Each display reads `void self.reloadCounter` in its `afterAttach` fetch autorun so a user-initiated reload re-runs the fetch even when no viewport/setting changed.                                                                                                                                                                                                                                                                                                                                                                         |
| [displayPhase](#getter-displayphase)                   | Getters   | Same precedence as MultiRegionDisplayMixin (single-sourced in `computeDisplayPhase`). A global display has no per-region staleness axis — it either has its one dataset or is fetching it — so its `loading` axis is simply "fetch in flight".                                                                                                                                                                                                                                                                                                                                                                  |
| [dataLoaded](#getter-dataloaded)                       | Getters   | Overridable hook (default false): a subclass returns true once its single global dataset has actually been fetched — even when the fetch committed an empty result. The mixin owns no data state, so a global display must express this; it is the global-display analog of `MultiRegionDisplayMixin.viewportWithinLoadedData`.                                                                                                                                                                                                                                                                                 |
| [svgReadyExtraTerminal](#getter-svgreadyextraterminal) | Getters   | Overridable hook (default false): a subclass returns true to mark an extra terminal state where off-screen export can proceed with no loaded data (mirrors `MultiRegionDisplayMixin.svgReadyExtraTerminal`).                                                                                                                                                                                                                                                                                                                                                                                                    |
| [svgReady](#getter-svgready)                           | Getters   | Global-display analog of `MultiRegionDisplayMixin.svgReady`: true once an off-screen (SVG) export can read final data. Like that mixin it requires the dataset to actually be loaded (or a terminal error / too-large / extra state), NOT merely "not currently fetching": the fetch trigger is a debounced `afterAttach` autorun, so at export time `isLoading` can still be false with no data yet — a `displayPhase !== 'loading'` test would then capture an empty render. Never gates on `canvasDrawn`, which an off-screen export never sets. Off-screen renderers gate on it via `awaitSvgReady(model)`. |
| [reload](#action-reload)                               | Actions   | Satisfies the `reload` contract `DisplayChrome` requires of every display (the per-region foundation provides its own). Clears any error and bumps `reloadCounter` so the display's fetch autorun re-runs. A subclass whose reload needs extra teardown can override and chain.                                                                                                                                                                                                                                                                                                                                 |

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
[regionStatuses](../fetchmixin#volatile-regionstatuses),
[lastStatusMs](../fetchmixin#volatile-laststatusms)

**Getters:** [isLoading](../fetchmixin#getter-isloading)

**Methods:** [makeStatusCallback](../fetchmixin#method-makestatuscallback),
[makeRegionStatusCallback](../fetchmixin#method-makeregionstatuscallback)

**Actions:** [setError](../fetchmixin#action-seterror),
[setStatusMessage](../fetchmixin#action-setstatusmessage),
[throttleStatus](../fetchmixin#action-throttlestatus),
[resetStatus](../fetchmixin#action-resetstatus),
[stopActiveFetch](../fetchmixin#action-stopactivefetch),
[setRegionStatus](../fetchmixin#action-setregionstatus),
[cancelFetch](../fetchmixin#action-cancelfetch),
[cancelFetchByUser](../fetchmixin#action-cancelfetchbyuser),
[runFetch](../fetchmixin#action-runfetch)

<details>
<summary>GlobalDataDisplayMixin - Volatiles</summary>

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

</details>

<details>
<summary>GlobalDataDisplayMixin - Getters</summary>

#### getter: displayPhase

Same precedence as MultiRegionDisplayMixin (single-sourced in
`computeDisplayPhase`). A global display has no per-region staleness axis — it
either has its one dataset or is fetching it — so its `loading` axis is simply
"fetch in flight".

```ts
type displayPhase = DisplayPhase
```

#### getter: dataLoaded

Overridable hook (default false): a subclass returns true once its single global
dataset has actually been fetched — even when the fetch committed an empty
result. The mixin owns no data state, so a global display must express this; it
is the global-display analog of
`MultiRegionDisplayMixin.viewportWithinLoadedData`.

```ts
type dataLoaded = boolean
```

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
<summary>GlobalDataDisplayMixin - Actions</summary>

#### action: reload

Satisfies the `reload` contract `DisplayChrome` requires of every display (the
per-region foundation provides its own). Clears any error and bumps
`reloadCounter` so the display's fetch autorun re-runs. A subclass whose reload
needs extra teardown can override and chain.

```ts
type reload = () => void
```

</details>
