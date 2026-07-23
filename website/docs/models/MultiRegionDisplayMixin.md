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

| Member                                                                 | Kind      | Defined by                                      | Description                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------- | --------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [loadedRegions](#volatile-loadedregions)                               | Volatiles | MultiRegionDisplayMixin                         | regions whose data has been fetched and committed, keyed by displayedRegionIndex; populated only after the fetch work callback returns                                                                                                                            |
| [isReady](#getter-isready)                                             | Getters   | MultiRegionDisplayMixin                         | true once the canvas has painted and no fetch is in flight                                                                                                                                                                                                        |
| [viewportWithinLoadedData](#getter-viewportwithinloadeddata)           | Getters   | MultiRegionDisplayMixin                         | true when every visible block lies within an already-fetched region — i.e. the viewport shows data we actually loaded, not the stale fringe left after a zoom-out/pan.                                                                                            |
| [svgReady](#getter-svgready)                                           | Getters   | MultiRegionDisplayMixin                         | true once an off-screen (SVG) export can safely read this display's data: every visible region has loaded, or the fetch reached a terminal error / too-large state.                                                                                               |
| [svgReadyExtraTerminal](#getter-svgreadyextraterminal)                 | Getters   | MultiRegionDisplayMixin                         | Overridable hook (default false): a subclass returns true to mark an extra terminal state where off-screen export can proceed with no loaded data.                                                                                                                |
| [layoutReady](#getter-layoutready)                                     | Getters   | MultiRegionDisplayMixin                         | Overridable hook (default false): whether a searchable feature layout currently exists.                                                                                                                                                                           |
| [renderBlocks](#getter-renderblocks)                                   | Getters   | MultiRegionDisplayMixin                         | Shared cached view for every LGV-based GPU display.                                                                                                                                                                                                               |
| [displayPhase](#getter-displayphase)                                   | Getters   | MultiRegionDisplayMixin                         | The display's mutually-exclusive visual state, precedence single-sourced in `computeDisplayPhase`.                                                                                                                                                                |
| [rpcPropsCacheKey](#getter-rpcpropscachekey)                           | Getters   | MultiRegionDisplayMixin                         | The RPC cache key: the subclass's `rpcProps()` payload serialized to a string, so this getter's value is a primitive and MobX invalidates its observers only when the payload actually changed.                                                                   |
| [derivedRegionTooLargeEnabled](#getter-derivedregiontoolargeenabled)   | Getters   | MultiRegionDisplayMixin                         | Derived opt-in for the region-too-large gate: a display that declares a pre-flight byte estimate (`getByteEstimateConfig`) gates on it — the two are one decision, so they can't desync (this replaces the old dev-time "config set but gate off" console.error). |
| [setLoadedRegion](#action-setloadedregion)                             | Actions   | MultiRegionDisplayMixin                         | Action wrapper so callers after async boundaries stay in MST strict mode.                                                                                                                                                                                         |
| [clearDisplaySpecificData](#action-cleardisplayspecificdata)           | Actions   | MultiRegionDisplayMixin                         | no-op base — subclasses override to clear rpcDataMap etc.                                                                                                                                                                                                         |
| [clearAllRpcData](#action-clearallrpcdata)                             | Actions   | MultiRegionDisplayMixin                         | full reset: cancels fetch, clears error, loadedRegions, display-specific data, and the canvas-drawn flag.                                                                                                                                                         |
| [reload](#action-reload)                                               | Actions   | MultiRegionDisplayMixin                         | Default reload: full reset.                                                                                                                                                                                                                                       |
| [invalidateLoadedRegions](#action-invalidateloadedregions)             | Actions   | MultiRegionDisplayMixin                         | lighter reset: cancels fetch and clears loadedRegions, leaving error and regionTooLarge intact                                                                                                                                                                    |
| [fetchNeeded](#action-fetchneeded)                                     | Actions   | MultiRegionDisplayMixin                         | Overridable hook (no-op base): override to call `this.fetchRegions(needed, async ctx => { ...                                                                                                                                                                     |
| [isCacheValid](#action-iscachevalid)                                   | Actions   | MultiRegionDisplayMixin                         | Overridable hook: return `false` to force re-fetch at the current zoom (wiggle uses this for zoom-level changes).                                                                                                                                                 |
| [getByteEstimateConfig](#action-getbyteestimateconfig)                 | Actions   | MultiRegionDisplayMixin                         | Overridable hook: return config to enable byte-estimate gating before fetch.                                                                                                                                                                                      |
| [onRegionTooLarge](#action-onregiontoolarge)                           | Actions   | MultiRegionDisplayMixin                         | Overridable hook (no-op base): called when `regionTooLarge` transitions to true.                                                                                                                                                                                  |
| [fetchRegions](#action-fetchregions)                                   | Actions   | MultiRegionDisplayMixin                         | Run a per-region fetch with byte-estimate gating.                                                                                                                                                                                                                 |
| [afterAttach](#action-afterattach)                                     | Actions   | MultiRegionDisplayMixin                         | installs the five fetch-lifecycle autoruns (DisplayedRegionsChange, FetchVisibleRegions, SettingsInvalidate, ClearBlockingStateOnViewportChange, ClearHoverOnRegionTooLarge)                                                                                      |
| [userByteLimit](#volatile-userbytelimit)                               | Volatiles | [RegionTooLargeMixin](../regiontoolargemixin)   | user-confirmed byte limit after a force-load, disabling the gate.                                                                                                                                                                                                 |
| [byteEstimate](#volatile-byteestimate)                                 | Volatiles | [RegionTooLargeMixin](../regiontoolargemixin)   | Last byte estimate reported for this display, with the adapter's own `fetchSizeLimit` and `alwaysRender` flag.                                                                                                                                                    |
| [measuredSpanBp](#volatile-measuredspanbp)                             | Volatiles | [RegionTooLargeMixin](../regiontoolargemixin)   | The span the current `byteEstimate` was measured over, so the derived gate can rescale it to the span on screen now.                                                                                                                                              |
| [configuredFetchSizeLimit](#getter-configuredfetchsizelimit)           | Getters   | [RegionTooLargeMixin](../regiontoolargemixin)   | The composing display's configured `fetchSizeLimit`, read straight from its config.                                                                                                                                                                               |
| [densityTooLargeForDerivedGate](#getter-densitytoolargeforderivedgate) | Getters   | [RegionTooLargeMixin](../regiontoolargemixin)   | Extra (non-byte) too-large axis folded into the derived verdict — canvas overrides it with its feature-density gate.                                                                                                                                              |
| [configForceLoad](#getter-configforceload)                             | Getters   | [RegionTooLargeMixin](../regiontoolargemixin)   | Declarative force-load: when true the display always renders regardless of region size / feature density (the config-driven equivalent of the force-load button).                                                                                                 |
| [estimatedBytesForVisibleSpan](#getter-estimatedbytesforvisiblespan)   | Getters   | [RegionTooLargeMixin](../regiontoolargemixin)   | How many bytes we estimate a fetch of the span on screen right now would pull, obtained by rescaling the stored estimate from the span it was measured over (`measuredSpanBp`).                                                                                   |
| [tooLargeStatus](#getter-toolargestatus)                               | Getters   | [RegionTooLargeMixin](../regiontoolargemixin)   | Shared derived verdict + reason (AUTO_FORCE_LOAD_BP floor, then bytes-over-limit, then the density axis), fed the scaled estimate so the byte gate self-releases on zoom-in.                                                                                      |
| [regionTooLarge](#getter-regiontoolarge)                               | Getters   | [RegionTooLargeMixin](../regiontoolargemixin)   | The verdict the whole mixin exists to produce: true when the estimated download for the span on screen exceeds the resolved byte budget, or when the display's own density axis trips.                                                                            |
| [regionTooLargeReason](#getter-regiontoolargereason)                   | Getters   | [RegionTooLargeMixin](../regiontoolargemixin)   | Which axis tripped, as banner text: the estimated download size, or "Too many features".                                                                                                                                                                          |
| [regionCannotBeRenderedText](#method-regioncannotberenderedtext)       | Methods   | [RegionTooLargeMixin](../regiontoolargemixin)   | Plaintext reason (for SVG export); the on-screen too-large UI is rendered by the display chrome via `TooLargeMessage`, not the model.                                                                                                                             |
| [setByteEstimate](#action-setbyteestimate)                             | Actions   | [RegionTooLargeMixin](../regiontoolargemixin)   | Commits the byte estimate and records the span it covers (`measuredSpanBp`) so the derived gate can rescale it to the span on screen.                                                                                                                             |
| [raiseForceLoadLimits](#action-raiseforceloadlimits)                   | Actions   | [RegionTooLargeMixin](../regiontoolargemixin)   | force-load: raise the byte limit past the current request so the gate releases.                                                                                                                                                                                   |
| [forceLoad](#action-forceload)                                         | Actions   | [RegionTooLargeMixin](../regiontoolargemixin)   | Raises the byte limit past the current estimate and triggers a reload.                                                                                                                                                                                            |
| [canvasDrawn](#volatile-canvasdrawn)                                   | Volatiles | [RenderLifecycleMixin](../renderlifecyclemixin) | flips true on first paint; read by test selectors to detect render                                                                                                                                                                                                |
| [currentRenderingBackend](#volatile-currentrenderingbackend)           | Volatiles | [RenderLifecycleMixin](../renderlifecyclemixin) | current backend reference, updated on context-loss recovery.                                                                                                                                                                                                      |
| [renderTick](#volatile-rendertick)                                     | Volatiles | [RenderLifecycleMixin](../renderlifecyclemixin) | counter the render autorun observes; bumped to force a re-render                                                                                                                                                                                                  |
| [autorunsInstalled](#volatile-autorunsinstalled)                       | Volatiles | [RenderLifecycleMixin](../renderlifecyclemixin) | guards attachRenderingBackend so the autorun pair spawns once per instance                                                                                                                                                                                        |
| [renderError](#volatile-rendererror)                                   | Volatiles | [RenderLifecycleMixin](../renderlifecyclemixin) | the render-backend (GPU/Canvas2D init or context-loss) error, or undefined.                                                                                                                                                                                       |
| [markCanvasDrawn](#action-markcanvasdrawn)                             | Actions   | [RenderLifecycleMixin](../renderlifecyclemixin) |                                                                                                                                                                                                                                                                   |
| [resetCanvasDrawn](#action-resetcanvasdrawn)                           | Actions   | [RenderLifecycleMixin](../renderlifecyclemixin) |                                                                                                                                                                                                                                                                   |
| [stopRenderingBackend](#action-stoprenderingbackend)                   | Actions   | [RenderLifecycleMixin](../renderlifecyclemixin) |                                                                                                                                                                                                                                                                   |
| [renderNow](#action-rendernow)                                         | Actions   | [RenderLifecycleMixin](../renderlifecyclemixin) |                                                                                                                                                                                                                                                                   |
| [setRenderError](#action-setrendererror)                               | Actions   | [RenderLifecycleMixin](../renderlifecyclemixin) | set/clear the render-backend error.                                                                                                                                                                                                                               |
| [attachRenderingBackend](#action-attachrenderingbackend)               | Actions   | [RenderLifecycleMixin](../renderlifecyclemixin) | attach a GPU/Canvas2D backend and install the upload + render autorun pair (idempotent — re-calling only swaps the backend)                                                                                                                                       |
| [activeStopToken](#volatile-activestoptoken)                           | Volatiles | [FetchMixin](../fetchmixin)                     | stop token of the in-flight fetch, or undefined when idle                                                                                                                                                                                                         |
| [fetchGeneration](#volatile-fetchgeneration)                           | Volatiles | [FetchMixin](../fetchmixin)                     | bumps at every fetch end; autoruns read it to re-evaluate, and it doubles as the staleness epoch inside runFetch                                                                                                                                                  |
| [error](#volatile-error)                                               | Volatiles | [FetchMixin](../fetchmixin)                     | last non-abort fetch error, or undefined                                                                                                                                                                                                                          |
| [statusMessage](#volatile-statusmessage)                               | Volatiles | [FetchMixin](../fetchmixin)                     | work-in-progress status string                                                                                                                                                                                                                                    |
| [statusProgress](#volatile-statusprogress)                             | Volatiles | [FetchMixin](../fetchmixin)                     | determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate                                                                                                                                                |
| [fetchCanceled](#volatile-fetchcanceled)                               | Volatiles | [FetchMixin](../fetchmixin)                     | true after the user explicitly cancels a load (the loading overlay's cancel button → `cancelFetchByUser`).                                                                                                                                                        |
| [regionStatuses](#volatile-regionstatuses)                             | Volatiles | [FetchMixin](../fetchmixin)                     | latest status of each concurrent in-flight operation, keyed by an arbitrary id (the canvas display uses displayedRegionIndex).                                                                                                                                    |
| [lastStatusMs](#volatile-laststatusms)                                 | Volatiles | [FetchMixin](../fetchmixin)                     | Date.now() of the last applied status write; the status callbacks gate on it to throttle a high-frequency progress stream.                                                                                                                                        |
| [isLoading](#getter-isloading)                                         | Getters   | [FetchMixin](../fetchmixin)                     | true while a fetch is active                                                                                                                                                                                                                                      |
| [makeStatusCallback](#method-makestatuscallback)                       | Methods   | [FetchMixin](../fetchmixin)                     | An RPC `statusCallback` bound to this display: forwards progress to the shared `statusMessage`, guarded by `isAlive` so a callback that fires after the node is torn down (RPCs resolve their status stream asynchronously) is a safe no-op.                      |
| [makeRegionStatusCallback](#method-makeregionstatuscallback)           | Methods   | [FetchMixin](../fetchmixin)                     | Per-region variant of `makeStatusCallback`: routes progress through `setRegionStatus(key, …)` so N concurrent per-region fetches aggregate into one status bar instead of clobbering each other.                                                                  |
| [setError](#action-seterror)                                           | Actions   | [FetchMixin](../fetchmixin)                     |                                                                                                                                                                                                                                                                   |
| [setStatusMessage](#action-setstatusmessage)                           | Actions   | [FetchMixin](../fetchmixin)                     |                                                                                                                                                                                                                                                                   |
| [throttleStatus](#action-throttlestatus)                               | Actions   | [FetchMixin](../fetchmixin)                     | Run `apply` only if at least `STATUS_THROTTLE_MS` has passed since the last status write.                                                                                                                                                                         |
| [resetStatus](#action-resetstatus)                                     | Actions   | [FetchMixin](../fetchmixin)                     | Drop the active stop token and clear all status bookkeeping.                                                                                                                                                                                                      |
| [stopActiveFetch](#action-stopactivefetch)                             | Actions   | [FetchMixin](../fetchmixin)                     | Abort the in-flight fetch (if any) and clear its status.                                                                                                                                                                                                          |
| [setRegionStatus](#action-setregionstatus)                             | Actions   | [FetchMixin](../fetchmixin)                     | Record one concurrent operation's latest status (keyed) and recompute the shared statusMessage/statusProgress as the aggregate across all in-flight keys.                                                                                                         |
| [cancelFetch](#action-cancelfetch)                                     | Actions   | [FetchMixin](../fetchmixin)                     | cancel any in-flight fetch and bump fetchGeneration (always bumps, so callers can retrigger fetch autoruns even when nothing was in flight).                                                                                                                      |
| [cancelFetchByUser](#action-cancelfetchbyuser)                         | Actions   | [FetchMixin](../fetchmixin)                     | User-initiated cancel from the loading overlay.                                                                                                                                                                                                                   |
| [beforeDestroy](#action-beforedestroy)                                 | Actions   | [FetchMixin](../fetchmixin)                     | Release an in-flight fetch's stop token on teardown.                                                                                                                                                                                                              |
| [runFetch](#action-runfetch)                                           | Actions   | [FetchMixin](../fetchmixin)                     | Run a cancel-safe fetch (cancels any prior).                                                                                                                                                                                                                      |

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

| Member                                                     | Type                                        |
| ---------------------------------------------------------- | ------------------------------------------- |
| <span id="action-seterror">setError</span>                 | `(error?: unknown) => void`                 |
| <span id="action-setstatusmessage">setStatusMessage</span> | `(status?: RpcStatus \| undefined) => void` |

</details>
