---
id: multiregiondisplaymixin
title: MultiRegionDisplayMixin
sidebar_label: Mixin -> MultiRegionDisplayMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`linear-genome-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/BaseLinearDisplay/models/MultiRegionDisplayMixin.ts).

## Overview

Per-region fetch lifecycle for LGV-based GPU displays. Installs five autoruns in
`afterAttach` and exposes overridable hooks (`fetchNeeded`, `rpcProps`,
`isCacheValid`, `getByteEstimateConfig`, `clearDisplaySpecificData`) plus the
`fetchRegions` / `loadedRegions` machinery.

## Members

| Member                                                                 | Kind       | Defined by                                      | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------- | ---------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [loadedRegions](#volatile-loadedregions)                               | Volatiles  | MultiRegionDisplayMixin                         | regions whose data has been fetched and committed, keyed by displayedRegionIndex; populated only after the fetch work callback returns                                                                                                                                                                                                                                                                                                                                                         |
| [isReady](#getter-isready)                                             | Getters    | MultiRegionDisplayMixin                         | true once the canvas has painted and no fetch is in flight                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [viewportWithinLoadedData](#getter-viewportwithinloadeddata)           | Getters    | MultiRegionDisplayMixin                         | true when every visible block lies within an already-fetched region — i.e. the viewport shows data we actually loaded, not the stale fringe left after a zoom-out/pan. Drives the loading overlay through the pre-refetch debounce. Spatial only; see CLAUDE.md for why this is exact and for the resolution-staleness gap.                                                                                                                                                                    |
| [svgReady](#getter-svgready)                                           | Getters    | MultiRegionDisplayMixin                         | true once an off-screen (SVG) export can safely read this display's data: every visible region has loaded, or the fetch reached a terminal error / too-large state. Off-screen renderers gate on it via `awaitSvgReady(model)` instead of inlining the condition. Regions stream in one at a time, so gating on `viewportWithinLoadedData` (not the first datum) is what keeps multi-region/whole-genome exports complete; `loadedRegions.size` guards the vacuously-true empty-viewport case. |
| [svgReadyExtraTerminal](#getter-svgreadyextraterminal)                 | Getters    | MultiRegionDisplayMixin                         | Overridable hook (default false): a subclass returns true to mark an extra terminal state where off-screen export can proceed with no loaded data. Sequence sets it when zoomed past base resolution — it renders a static "zoom in" message and fetches nothing, so `svgReady` would otherwise never resolve.                                                                                                                                                                                 |
| [layoutReady](#getter-layoutready)                                     | Getters    | MultiRegionDisplayMixin                         | Overridable hook (default false): whether a searchable feature layout currently exists. Any display defining a feature-lookup method (`searchFeatureByID`, `getFeatureById`) must override it, so callers can tell "laid out, but off-display" from "no layout exists yet" — a distinction only the display can make. See BaseLinearDisplay/CLAUDE.md, "The three readiness axes".                                                                                                             |
| [renderBlocks](#getter-renderblocks)                                   | Getters    | MultiRegionDisplayMixin                         | Shared cached view for every LGV-based GPU display. A single displayedRegion may produce multiple render blocks (shared GPU buffer, different scissor clips on screen). Plugins that want to suppress rendering in certain states (e.g. no domain yet) can override this getter to return [] — the autorun lifecycle will then issue an empty-blocks render that clears the canvas.                                                                                                            |
| [displayPhase](#getter-displayphase)                                   | Getters    | MultiRegionDisplayMixin                         | The display's mutually-exclusive visual state, precedence single-sourced in `computeDisplayPhase`. Here `loading` means data isn't ready yet, or stale data (viewport past loaded) is still on screen through the pre-refetch debounce.                                                                                                                                                                                                                                                        |
| [setLoadedRegion](#action-setloadedregion)                             | Actions    | MultiRegionDisplayMixin                         | Action wrapper so callers after async boundaries stay in MST strict mode.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [clearDisplaySpecificData](#action-cleardisplayspecificdata)           | Actions    | MultiRegionDisplayMixin                         | no-op base — subclasses override to clear rpcDataMap etc.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [clearAllRpcData](#action-clearallrpcdata)                             | Actions    | MultiRegionDisplayMixin                         | full reset: cancels fetch, clears error, loadedRegions, display-specific data, and the canvas-drawn flag. The too-large gate is derived (a pure function of the cached estimate × viewport), so it needs no explicit clear here — it self-releases when the viewport changes.                                                                                                                                                                                                                  |
| [reload](#action-reload)                                               | Actions    | MultiRegionDisplayMixin                         | Default reload: full reset. Subclasses with extra teardown can override (and chain to `clearAllRpcData` directly if needed).                                                                                                                                                                                                                                                                                                                                                                   |
| [invalidateLoadedRegions](#action-invalidateloadedregions)             | Actions    | MultiRegionDisplayMixin                         | lighter reset: cancels fetch and clears loadedRegions, leaving error and regionTooLarge intact                                                                                                                                                                                                                                                                                                                                                                                                 |
| [fetchNeeded](#action-fetchneeded)                                     | Actions    | MultiRegionDisplayMixin                         | Overridable hook (no-op base): override to call `this.fetchRegions(needed, async ctx => { ... })`.                                                                                                                                                                                                                                                                                                                                                                                             |
| [isCacheValid](#action-iscachevalid)                                   | Actions    | MultiRegionDisplayMixin                         | Overridable hook: return `false` to force re-fetch at the current zoom (wiggle uses this for zoom-level changes).                                                                                                                                                                                                                                                                                                                                                                              |
| [getByteEstimateConfig](#action-getbyteestimateconfig)                 | Actions    | MultiRegionDisplayMixin                         | Overridable hook: return config to enable byte-estimate gating before fetch.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [onRegionTooLarge](#action-onregiontoolarge)                           | Actions    | MultiRegionDisplayMixin                         | Overridable hook (no-op base): called when `regionTooLarge` transitions to true. Displays with transient hover/tooltip state override it to clear that state — the too-large banner replaces the rendered content, so a lingering hover would otherwise pin to a now-hidden feature. Wired to the `ClearHoverOnRegionTooLarge` autorun, fired by the derived too-large gate.                                                                                                                   |
| [fetchRegions](#action-fetchregions)                                   | Actions    | MultiRegionDisplayMixin                         | Run a per-region fetch with byte-estimate gating. Marks regions as loaded only AFTER the work callback has populated display-specific data (rpcDataMap, cellData, etc) so the GPU upload autorun sees committed data when it observes loadedRegions.                                                                                                                                                                                                                                           |
| [afterAttach](#action-afterattach)                                     | Actions    | MultiRegionDisplayMixin                         | installs the five fetch-lifecycle autoruns (DisplayedRegionsChange, FetchVisibleRegions, SettingsInvalidate, ClearBlockingStateOnViewportChange, ClearHoverOnRegionTooLarge)                                                                                                                                                                                                                                                                                                                   |
| [userByteSizeLimit](#property-userbytesizelimit)                       | Properties | [RegionTooLargeMixin](../regiontoolargemixin)   | user-confirmed byte limit after a force-load, disabling the gate                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [featureDensityStats](#volatile-featuredensitystats)                   | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [byteEstimateVisibleBp](#volatile-byteestimatevisiblebp)               | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)   | visibleBp at which the current `featureDensityStats` byte estimate was captured, so the derived gate (`estimatedVisibleBytes`) can scale it to the current view. Written by `setFeatureDensityStats`; ignored unless `derivedRegionTooLargeEnabled`.                                                                                                                                                                                                                                           |
| [derivedRegionTooLargeEnabled](#getter-derivedregiontoolargeenabled)   | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)   | Opt-in switch: a byte-gated display flips this true to enable the derived, self-releasing region-too-large gate. Default false means the display never gates on size (`regionTooLarge` is always false), so non-byte displays (wiggle, manhattan, sequence, synteny, …) don't evaluate the LGV-only `tooLargeStatus` getters at all.                                                                                                                                                           |
| [configuredFetchSizeLimit](#getter-configuredfetchsizelimit)           | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)   | The composing display's configured `fetchSizeLimit`. This mixin owns no `configuration`, so a derived display overrides this with `getConf(self, 'fetchSizeLimit')`. Only read when the derived gate is enabled; the default matches the BaseLinearDisplay slot default.                                                                                                                                                                                                                       |
| [densityTooLargeForDerivedGate](#getter-densitytoolargeforderivedgate) | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)   | Extra (non-byte) too-large axis folded into the derived verdict — canvas overrides it with its feature-density gate. Byte-only derived displays leave it false.                                                                                                                                                                                                                                                                                                                                |
| [estimatedVisibleBytes](#getter-estimatedvisiblebytes)                 | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)   | The cached byte estimate scaled from the span it was measured over (`byteEstimateVisibleBp`) to the currently visible span. Roughly proportional to span, so scaling makes the derived verdict a pure function of the current view and self-releases on zoom-in — without it a large zoomed-out estimate stays above the limit forever and gates refetch. Only meaningful when `derivedRegionTooLargeEnabled`.                                                                                 |
| [tooLargeStatus](#getter-toolargestatus)                               | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)   | Shared derived verdict + reason (AUTO_FORCE_LOAD_BP floor, then bytes-over-limit, then the density axis), fed the scaled estimate so the byte gate self-releases on zoom-in. Same helper as every other gating path so the banner text can't drift.                                                                                                                                                                                                                                            |
| [regionTooLarge](#getter-regiontoolarge)                               | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [regionTooLargeReason](#getter-regiontoolargereason)                   | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [regionCannotBeRenderedText](#method-regioncannotberenderedtext)       | Methods    | [RegionTooLargeMixin](../regiontoolargemixin)   | Plaintext reason (for SVG export); the on-screen too-large UI is rendered by the display chrome via `TooLargeMessage`, not the model.                                                                                                                                                                                                                                                                                                                                                          |
| [setFeatureDensityStats](#action-setfeaturedensitystats)               | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)   | Commits the byte estimate and records the span it was measured at (`byteEstimateVisibleBp`) so the derived gate can scale it to the current view. The capture is harmless for non-gated displays (they ignore it).                                                                                                                                                                                                                                                                             |
| [setFeatureDensityStatsLimit](#action-setfeaturedensitystatslimit)     | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)   | force-load: raise the byte limit past the current request so the gate releases. Raises past the estimate scaled to the _current_ view (not the raw captured bytes), so it clears even if the view zoomed out after the estimate was captured; `raiseLimitPast` is the raw fallback for a display with no scaled estimate. Canvas (which also has a density force-load) overrides this entirely.                                                                                                |
| [forceLoad](#action-forceload)                                         | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)   | Raises the byte limit past the current density stats and triggers a reload. The display chrome calls this via TooLargeMessage's force-load button; concrete display models override reload() to do the actual refetch.                                                                                                                                                                                                                                                                         |
| [canvasDrawn](#volatile-canvasdrawn)                                   | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin) | flips true on first paint; read by test selectors to detect render                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [currentRenderingBackend](#volatile-currentrenderingbackend)           | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin) | current backend reference, updated on context-loss recovery. Typed `unknown` (not generic `B`) on purpose: this mixin is composed by every display via a non-generic factory, so the per-display backend type `B` isn't known here — it's supplied at `attachRenderingBackend<B>` and narrowed with `as B` inside the autoruns. Don't "fix" the cast.                                                                                                                                          |
| [renderTick](#volatile-rendertick)                                     | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin) | counter the render autorun observes; bumped to force a re-render                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [autorunsInstalled](#volatile-autorunsinstalled)                       | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin) | guards attachRenderingBackend so the autorun pair spawns once per instance                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [renderError](#volatile-rendererror)                                   | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin) | the render-backend (GPU/Canvas2D init or context-loss) error, or undefined. Single source of truth for the render-error terminal state: `useRenderingBackend` writes it from the canvas-init mechanism so the model — not React-local hook state — owns every terminal state. Read by `displayPhase` (whose `renderError` term outranks `loading`, suppressing the scrim) and by `DisplayChrome` (shows the retry overlay).                                                                    |
| [markCanvasDrawn](#action-markcanvasdrawn)                             | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [resetCanvasDrawn](#action-resetcanvasdrawn)                           | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [stopRenderingBackend](#action-stoprenderingbackend)                   | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [renderNow](#action-rendernow)                                         | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [setRenderError](#action-setrendererror)                               | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin) | set/clear the render-backend error. Called by `useRenderingBackend`: with the error when the canvas factory rejects (or context-loss re-init fails), and with `undefined` on successful (re)init and on retry.                                                                                                                                                                                                                                                                                 |
| [attachRenderingBackend](#action-attachrenderingbackend)               | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin) | attach a GPU/Canvas2D backend and install the upload + render autorun pair (idempotent — re-calling only swaps the backend)                                                                                                                                                                                                                                                                                                                                                                    |
| [activeStopToken](#volatile-activestoptoken)                           | Volatiles  | [FetchMixin](../fetchmixin)                     | stop token of the in-flight fetch, or undefined when idle                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [fetchGeneration](#volatile-fetchgeneration)                           | Volatiles  | [FetchMixin](../fetchmixin)                     | bumps at every fetch end; autoruns read it to re-evaluate, and it doubles as the staleness epoch inside runFetch                                                                                                                                                                                                                                                                                                                                                                               |
| [error](#volatile-error)                                               | Volatiles  | [FetchMixin](../fetchmixin)                     | last non-abort fetch error, or undefined                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [statusMessage](#volatile-statusmessage)                               | Volatiles  | [FetchMixin](../fetchmixin)                     | work-in-progress status string                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [statusProgress](#volatile-statusprogress)                             | Volatiles  | [FetchMixin](../fetchmixin)                     | determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate                                                                                                                                                                                                                                                                                                                                                                             |
| [fetchCanceled](#volatile-fetchcanceled)                               | Volatiles  | [FetchMixin](../fetchmixin)                     | true after the user explicitly cancels a load (the loading overlay's cancel button → `cancelFetchByUser`). A durable, blocking state — unlike `cancelFetch`, it does not retrigger the fetch autoruns — so the load stays stopped until the user retries (`reload`) or the viewport changes. Any new fetch clears it (`runFetch` resets it at the start).                                                                                                                                      |
| [regionStatuses](#volatile-regionstatuses)                             | Volatiles  | [FetchMixin](../fetchmixin)                     | latest status of each concurrent in-flight operation, keyed by an arbitrary id (the canvas display uses displayedRegionIndex). Plain bookkeeping — not read reactively; setRegionStatus derives the observable statusMessage/statusProgress from it on every update so N parallel region fetches aggregate into one bar instead of clobbering.                                                                                                                                                 |
| [lastStatusMs](#volatile-laststatusms)                                 | Volatiles  | [FetchMixin](../fetchmixin)                     | Date.now() of the last applied status write; the status callbacks gate on it to throttle a high-frequency progress stream.                                                                                                                                                                                                                                                                                                                                                                     |
| [isLoading](#getter-isloading)                                         | Getters    | [FetchMixin](../fetchmixin)                     | true while a fetch is active                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [makeStatusCallback](#method-makestatuscallback)                       | Methods    | [FetchMixin](../fetchmixin)                     | An RPC `statusCallback` bound to this display: forwards progress to the shared `statusMessage`, guarded by `isAlive` so a callback that fires after the node is torn down (RPCs resolve their status stream asynchronously) is a safe no-op. Pass directly as the `statusCallback` RPC arg instead of re-inlining the guard at every call site.                                                                                                                                                |
| [makeRegionStatusCallback](#method-makeregionstatuscallback)           | Methods    | [FetchMixin](../fetchmixin)                     | Per-region variant of `makeStatusCallback`: routes progress through `setRegionStatus(key, …)` so N concurrent per-region fetches aggregate into one status bar instead of clobbering each other. Same `isAlive` guard.                                                                                                                                                                                                                                                                         |
| [setError](#action-seterror)                                           | Actions    | [FetchMixin](../fetchmixin)                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [setStatusMessage](#action-setstatusmessage)                           | Actions    | [FetchMixin](../fetchmixin)                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [throttleStatus](#action-throttlestatus)                               | Actions    | [FetchMixin](../fetchmixin)                     | Run `apply` only if at least `STATUS_THROTTLE_MS` has passed since the last status write. A leading-edge throttle: sparse updates pass straight through, dense progress bursts are thinned so the loading overlay stops re-rendering faster than the view animates. The final status doesn't need a trailing flush — fetch completion clears it via `resetStatus`.                                                                                                                             |
| [resetStatus](#action-resetstatus)                                     | Actions    | [FetchMixin](../fetchmixin)                     | Drop the active stop token and clear all status bookkeeping. Shared by both cancel paths and runFetch's cleanup.                                                                                                                                                                                                                                                                                                                                                                               |
| [stopActiveFetch](#action-stopactivefetch)                             | Actions    | [FetchMixin](../fetchmixin)                     | Abort the in-flight fetch (if any) and clear its status. The shared preamble of both cancel paths; the difference between them is only what they do to `fetchCanceled` / `fetchGeneration` afterward.                                                                                                                                                                                                                                                                                          |
| [setRegionStatus](#action-setregionstatus)                             | Actions    | [FetchMixin](../fetchmixin)                     | Record one concurrent operation's latest status (keyed) and recompute the shared statusMessage/statusProgress as the aggregate across all in-flight keys. Pass undefined to drop a key. Used by displays that fan a single fetch out into parallel per-region RPCs.                                                                                                                                                                                                                            |
| [cancelFetch](#action-cancelfetch)                                     | Actions    | [FetchMixin](../fetchmixin)                     | cancel any in-flight fetch and bump fetchGeneration (always bumps, so callers can retrigger fetch autoruns even when nothing was in flight). This is the _internal_ reset used by clearAllRpcData/invalidateLoadedRegions — it clears any user-cancel flag so the retrigger actually re-fetches.                                                                                                                                                                                               |
| [cancelFetchByUser](#action-cancelfetchbyuser)                         | Actions    | [FetchMixin](../fetchmixin)                     | User-initiated cancel from the loading overlay. Stops the in-flight fetch and lands in a durable `fetchCanceled` state. Unlike `cancelFetch`, it does NOT bump fetchGeneration — so the fetch autoruns don't immediately restart the load. The user retries via `reload` (the overlay's retry button), or it clears on the next viewport change.                                                                                                                                               |
| [beforeDestroy](#action-beforedestroy)                                 | Actions    | [FetchMixin](../fetchmixin)                     | Release an in-flight fetch's stop token on teardown. Without this, a display destroyed mid-fetch (track/view closed while loading) never revokes its token — a blob-URL leak on the non-SAB fallback path — and never signals the worker to abort the now-useless work. MST auto-chains lifecycle hooks, so a composing display can still define its own beforeDestroy.                                                                                                                        |
| [runFetch](#action-runfetch)                                           | Actions    | [FetchMixin](../fetchmixin)                     | Run a cancel-safe fetch (cancels any prior). The work callback gets a FetchContext with a stopToken to forward to the RPC and an isStale() check to short-circuit commits once the user has moved on. Abort errors are swallowed; others are stored in `error` if not stale.                                                                                                                                                                                                                   |

<details>
<summary>MultiRegionDisplayMixin - Volatiles</summary>

#### volatile: loadedRegions

regions whose data has been fetched and committed, keyed by
displayedRegionIndex; populated only after the fetch work callback returns

```ts
// type signature
type loadedRegions = ObservableMap<number, Region>
// code
loadedRegions: observable.map<number, Region>()
```

</details>

<details>
<summary>MultiRegionDisplayMixin - Getters</summary>

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

</details>

<details>
<summary>MultiRegionDisplayMixin - Actions</summary>

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

#### action: reload

Default reload: full reset. Subclasses with extra teardown can override (and
chain to `clearAllRpcData` directly if needed).

```ts
type reload = () => void
```

#### action: invalidateLoadedRegions

lighter reset: cancels fetch and clears loadedRegions, leaving error and
regionTooLarge intact

```ts
type invalidateLoadedRegions = () => void
```

#### action: fetchNeeded

Overridable hook (no-op base): override to call
`this.fetchRegions(needed, async ctx => { ... })`.

```ts
type fetchNeeded = (
  _needed: { region: Region; displayedRegionIndex: number }[],
) => void
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

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

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

The composing display's configured `fetchSizeLimit`. This mixin owns no
`configuration`, so a derived display overrides this with
`getConf(self, 'fetchSizeLimit')`. Only read when the derived gate is enabled;
the default matches the BaseLinearDisplay slot default.

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

#### volatile: error

last non-abort fetch error, or undefined

```ts
// type signature
type error = unknown
// code
error: undefined as unknown
```

#### volatile: statusMessage

work-in-progress status string

```ts
// type signature
type statusMessage = string | undefined
// code
statusMessage: undefined as string | undefined
```

#### volatile: statusProgress

determinate progress fraction [0,1] for the current status, or undefined when
the in-flight phase is indeterminate

```ts
// type signature
type statusProgress = number | undefined
// code
statusProgress: undefined as number | undefined
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

#### action: setError

```ts
type setError = (error?: unknown) => void
```

#### action: setStatusMessage

```ts
type setStatusMessage = (status?: RpcStatus | undefined) => void
```

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
