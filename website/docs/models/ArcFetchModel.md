---
id: arcfetchmodel
title: ArcFetchModel
sidebar_label: Display -> ArcFetchModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`arc` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/arc/src/shared/ArcFetchModel.ts).

## Overview

Shared fetch/gating model for both arc displays. Composes the rendering-agnostic
`GlobalFetchMixin` (cancel-safe `runFetch`, region-too-large gate,
`reload`/`reloadCounter`, `svgReady`) and adds the arc-specific data state
(`features` + its region signature) plus a **derived** `regionTooLarge` — the
exact byte-only pattern LinearWiggle/LD/canvas use, so arc has no special
region-too-large handling: the banner is a pure function of the cached estimate
scaled to the current viewport and self-releases on zoom-in with no imperative
clear.

## Members

| Member                                                               | Kind      | Defined by                                    | Description                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------- | --------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [features](#volatile-features)                                       | Volatiles | ArcFetchModel                                 |                                                                                                                                                                                                                                                   |
| [loadedRegionSignature](#volatile-loadedregionsignature)             | Volatiles | ArcFetchModel                                 | signature of the static-block region set `features` were fetched for; the `dataCurrent`/`svgReady` freshness axis (see regionSignature.ts)                                                                                                        |
| [byteGateEnabled](#getter-bytegateenabled)                           | Getters   | ArcFetchModel                                 |                                                                                                                                                                                                                                                   |
| [dataCurrent](#getter-datacurrent)                                   | Getters   | ArcFetchModel                                 | fresh only when `features` were fetched for the current static-block set; overrides GlobalFetchMixin's default so `svgReady` can resolve on load                                                                                                  |
| [displayPhase](#getter-displayphase)                                 | Getters   | ArcFetchModel                                 | The same mutually-exclusive visual state every GPU display exposes, over the same shared `computeDisplayPhase` — arc just has no `renderError` phase, having no GPU backend.                                                                      |
| [setFeatures](#action-setfeatures)                                   | Actions   | ArcFetchModel                                 |                                                                                                                                                                                                                                                   |
| [reload](#action-reload)                                             | Actions   | ArcFetchModel                                 | Arc's fetch trigger gates on `!dataCurrent`, so bumping `reloadCounter` alone can't refetch: the signature still matches the current blocks.                                                                                                      |
| [reloadCounter](#volatile-reloadcounter)                             | Volatiles | [GlobalFetchMixin](../globalfetchmixin)       | Bumped by `reload()` to retrigger a global display's fetch autorun.                                                                                                                                                                               |
| [svgReadyExtraTerminal](#getter-svgreadyextraterminal)               | Getters   | [GlobalFetchMixin](../globalfetchmixin)       | Overridable hook (default false): a subclass returns true to mark an extra terminal state where off-screen export can proceed with no loaded data (mirrors `MultiRegionDisplayMixin.svgReadyExtraTerminal`).                                      |
| [svgReady](#getter-svgready)                                         | Getters   | [GlobalFetchMixin](../globalfetchmixin)       | Policy single-sourced in `computeSvgReady`; this family supplies only its `dataCurrent` predicate.                                                                                                                                                |
| [forceLoadTrack](#volatile-forceloadtrack)                           | Volatiles | [RegionTooLargeMixin](../regiontoolargemixin) | The force-load button's answer: render this track regardless of region size or feature density.                                                                                                                                                   |
| [byteEstimate](#volatile-byteestimate)                               | Volatiles | [RegionTooLargeMixin](../regiontoolargemixin) | The last byte measurement for this display: the estimated bytes **and the span they cover**, which is what lets the derived gate rescale them to the span on screen now.                                                                          |
| [gateFoldedIntoFetch](#getter-gatefoldedintofetch)                   | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | Additive opt-in for displays that measure the estimate inside their own feature RPC instead of a pre-flight (canvas).                                                                                                                             |
| [configuredFetchSizeLimit](#getter-configuredfetchsizelimit)         | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | The composing display's configured `fetchSizeLimit`, read straight from its config.                                                                                                                                                               |
| [densityTooLarge](#getter-densitytoolarge)                           | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | Second (non-byte) too-large axis folded into the derived verdict — canvas overrides it with its feature-density gate.                                                                                                                             |
| [adapterFetchSizeLimit](#getter-adapterfetchsizelimit)               | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | The adapter's own `fetchSizeLimit` slot (undefined when the adapter type declares none); `resolveByteLimit` prefers it over the display config.                                                                                                   |
| [configForceLoad](#getter-configforceload)                           | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | Declarative force-load: when true the display always renders regardless of region size / feature density (the config-driven equivalent of the force-load button).                                                                                 |
| [gateVisibleBp](#getter-gatevisiblebp)                               | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | The span on screen, or undefined before the view is measured.                                                                                                                                                                                     |
| [derivedRegionTooLargeEnabled](#getter-derivedregiontoolargeenabled) | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | Whether the derived, self-releasing gate is live at all — the union of the two ways a display can measure: a pre-flight estimate (`byteGateEnabled`) or a byte check folded into its own feature RPC (`gateFoldedIntoFetch`).                     |
| [aboveForceLoadFloor](#getter-aboveforceloadfloor)                   | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | Whether the span on screen is wide enough for the gate to have an opinion at all — the `AUTO_FORCE_LOAD_BP` floor, compared here and nowhere else.                                                                                                |
| [byteGateExempt](#getter-bytegateexempt)                             | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | True when nothing may gate, on either axis and in both the worker and the banner: the declarative `forceLoad` slot, or the force-load button.                                                                                                     |
| [estimatedBytesForVisibleSpan](#getter-estimatedbytesforvisiblespan) | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | How many bytes we estimate a fetch of the span on screen right now would pull, obtained by rescaling the stored measurement from the span it covers.                                                                                              |
| [gateByteLimit](#getter-gatebytelimit)                               | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | The byte budget the gate enforces: the adapter's limit, else the display config.                                                                                                                                                                  |
| [gateActive](#getter-gateactive)                                     | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | Whether anything may gate at this moment: the display opted in, nothing exempts it, and the view is measured and above the force-load floor.                                                                                                      |
| [tooLargeStatus](#getter-toolargestatus)                             | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | The verdict the whole mixin exists to produce, with the banner text: true when the estimated download for the span on screen exceeds the resolved byte budget, or when the display's own density axis trips (bytes take precedence for the text). |
| [regionTooLarge](#getter-regiontoolarge)                             | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) |                                                                                                                                                                                                                                                   |
| [regionTooLargeReason](#getter-regiontoolargereason)                 | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | Which axis tripped, as banner text: the estimated download size, or "Too many features".                                                                                                                                                          |
| [resolvedByteLimit](#method-resolvedbytelimit)                       | Methods   | [RegionTooLargeMixin](../regiontoolargemixin) | The byte budget a fetch RPC enforces worker-side, short-circuiting an over-budget region before it downloads any features.                                                                                                                        |
| [setByteEstimate](#action-setbyteestimate)                           | Actions   | [RegionTooLargeMixin](../regiontoolargemixin) | Commits a byte measurement: the estimate together with the span it covers, so the derived gate can rescale it to the span on screen.                                                                                                              |
| [clearByteEstimate](#action-clearbyteestimate)                       | Actions   | [RegionTooLargeMixin](../regiontoolargemixin) | Drops the cached estimate.                                                                                                                                                                                                                        |
| [setForceLoadTrack](#action-setforceloadtrack)                       | Actions   | [RegionTooLargeMixin](../regiontoolargemixin) | Exempt this track from the gate (or put it back under it).                                                                                                                                                                                        |
| [forceLoad](#action-forceload)                                       | Actions   | [RegionTooLargeMixin](../regiontoolargemixin) | Force-load: exempt this track from the gate and refetch.                                                                                                                                                                                          |
| [byteGateBlocksFetch](#action-bytegateblocksfetch)                   | Actions   | [RegionTooLargeMixin](../regiontoolargemixin) | The entire pre-flight gate for one fetch: measure the region set, commit the estimate with the span it covers, and answer whether the caller must abandon the fetch — either superseded mid-measure, or over budget.                              |
| [activeStopToken](#volatile-activestoptoken)                         | Volatiles | [FetchMixin](../fetchmixin)                   | stop token of the in-flight fetch, or undefined when idle                                                                                                                                                                                         |
| [fetchGeneration](#volatile-fetchgeneration)                         | Volatiles | [FetchMixin](../fetchmixin)                   | bumps at every fetch end; autoruns read it to re-evaluate, and it doubles as the staleness epoch inside runFetch                                                                                                                                  |
| [error](#volatile-error)                                             | Volatiles | [FetchMixin](../fetchmixin)                   | last non-abort fetch error, or undefined                                                                                                                                                                                                          |
| [statusMessage](#volatile-statusmessage)                             | Volatiles | [FetchMixin](../fetchmixin)                   | work-in-progress status string                                                                                                                                                                                                                    |
| [statusProgress](#volatile-statusprogress)                           | Volatiles | [FetchMixin](../fetchmixin)                   | determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate                                                                                                                                |
| [fetchCanceled](#volatile-fetchcanceled)                             | Volatiles | [FetchMixin](../fetchmixin)                   | true after the user explicitly cancels a load (the loading overlay's cancel button → `cancelFetchByUser`).                                                                                                                                        |
| [regionStatuses](#volatile-regionstatuses)                           | Volatiles | [FetchMixin](../fetchmixin)                   | latest status of each concurrent in-flight operation, keyed by an arbitrary id (the canvas display uses displayedRegionIndex).                                                                                                                    |
| [isLoading](#getter-isloading)                                       | Getters   | [FetchMixin](../fetchmixin)                   | true while a fetch is active                                                                                                                                                                                                                      |
| [makeStatusCallback](#method-makestatuscallback)                     | Methods   | [FetchMixin](../fetchmixin)                   | An RPC `statusCallback` bound to this display: forwards progress to the shared `statusMessage`, guarded by `isAlive` so a callback that fires after the node is torn down (RPCs resolve their status stream asynchronously) is a safe no-op.      |
| [makeRegionStatusCallback](#method-makeregionstatuscallback)         | Methods   | [FetchMixin](../fetchmixin)                   | Per-region variant of `makeStatusCallback`: routes progress through `setRegionStatus(key, …)` so N concurrent per-region fetches aggregate into one status bar instead of clobbering each other.                                                  |
| [setError](#action-seterror)                                         | Actions   | [FetchMixin](../fetchmixin)                   |                                                                                                                                                                                                                                                   |
| [setStatusMessage](#action-setstatusmessage)                         | Actions   | [FetchMixin](../fetchmixin)                   | Unthrottled: a display writing a phase label by hand must see every write land.                                                                                                                                                                   |
| [throttleStatus](#action-throttlestatus)                             | Actions   | [FetchMixin](../fetchmixin)                   | Run `apply` only if the throttle window has elapsed.                                                                                                                                                                                              |
| [resetStatus](#action-resetstatus)                                   | Actions   | [FetchMixin](../fetchmixin)                   | Drop the active stop token and clear all status bookkeeping.                                                                                                                                                                                      |
| [stopActiveFetch](#action-stopactivefetch)                           | Actions   | [FetchMixin](../fetchmixin)                   | Abort the in-flight fetch (if any) and clear its status.                                                                                                                                                                                          |
| [setRegionStatus](#action-setregionstatus)                           | Actions   | [FetchMixin](../fetchmixin)                   | Record one concurrent operation's latest status (keyed) and recompute the shared statusMessage/statusProgress as the aggregate across all in-flight keys.                                                                                         |
| [cancelFetch](#action-cancelfetch)                                   | Actions   | [FetchMixin](../fetchmixin)                   | cancel any in-flight fetch and bump fetchGeneration (always bumps, so callers can retrigger fetch autoruns even when nothing was in flight).                                                                                                      |
| [cancelFetchByUser](#action-cancelfetchbyuser)                       | Actions   | [FetchMixin](../fetchmixin)                   | User-initiated cancel from the loading overlay.                                                                                                                                                                                                   |
| [beforeDestroy](#action-beforedestroy)                               | Actions   | [FetchMixin](../fetchmixin)                   | Release an in-flight fetch's stop token on teardown.                                                                                                                                                                                              |
| [runFetch](#action-runfetch)                                         | Actions   | [FetchMixin](../fetchmixin)                   | Run a cancel-safe fetch (cancels any prior).                                                                                                                                                                                                      |

<details>
<summary>ArcFetchModel - Volatiles</summary>

#### volatile: loadedRegionSignature

signature of the static-block region set `features` were fetched for; the
`dataCurrent`/`svgReady` freshness axis (see regionSignature.ts)

```ts
// type signature
type loadedRegionSignature = string | undefined
// code
loadedRegionSignature: undefined as string | undefined
```

</details>

<details>
<summary>ArcFetchModel - Volatiles (other undocumented members)</summary>

| Member                                       | Type                     |
| -------------------------------------------- | ------------------------ |
| <span id="volatile-features">features</span> | `Feature[] \| undefined` |

</details>

<details>
<summary>ArcFetchModel - Getters</summary>

#### getter: dataCurrent

fresh only when `features` were fetched for the current static-block set;
overrides GlobalFetchMixin's default so `svgReady` can resolve on load

```ts
type dataCurrent = boolean
```

#### getter: displayPhase

The same mutually-exclusive visual state every GPU display exposes, over the
same shared `computeDisplayPhase` — arc just has no `renderError` phase, having
no GPU backend. On the model rather than derived inside `BaseDisplayComponent`
so the component can't disagree with the model, and so arc publishes
`data-display-phase` for tests like every other display.

```ts
type displayPhase = DisplayPhase
```

</details>

<details>
<summary>ArcFetchModel - Getters (other undocumented members)</summary>

| Member                                                   | Type      |
| -------------------------------------------------------- | --------- |
| <span id="getter-bytegateenabled">byteGateEnabled</span> | `boolean` |

</details>

<details>
<summary>ArcFetchModel - Actions</summary>

#### action: reload

Arc's fetch trigger gates on `!dataCurrent`, so bumping `reloadCounter` alone
can't refetch: the signature still matches the current blocks. Drop it so
`dataCurrent` goes false and the autorun fires. `features` deliberately survives
— the stale arcs stay on screen under the loading overlay rather than blanking,
and `setFeatures` replaces them.

```ts
type reload = () => void
```

</details>

<details>
<summary>ArcFetchModel - Actions (other undocumented members)</summary>

| Member                                           | Type                                        |
| ------------------------------------------------ | ------------------------------------------- |
| <span id="action-setfeatures">setFeatures</span> | `(f: Feature[], signature: string) => void` |

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

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

#### getter: aboveForceLoadFloor

Whether the span on screen is wide enough for the gate to have an opinion at all
— the `AUTO_FORCE_LOAD_BP` floor, compared here and nowhere else. False before
the view is measured.

Deliberately independent of the opt-in and of force-load, so a display whose
_own_ opt-in depends on the floor can read it without a cycle: MAF's
`showSummary` swaps to the cheap summary adapter exactly where the detail fetch
would be gated, and `byteGateEnabled` is off while it does. `gateActive` adds
the opt-in and exemption terms on top.

```ts
type aboveForceLoadFloor = boolean
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
it, and the view is measured and above the force-load floor.

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

#### action: setStatusMessage

Unthrottled: a display writing a phase label by hand must see every write land.
The high-frequency RPC stream is thinned one level up, in the callback
factories.

```ts
type setStatusMessage = (status?: RpcStatus | undefined) => void
```

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

| Member                                     | Type                        |
| ------------------------------------------ | --------------------------- |
| <span id="action-seterror">setError</span> | `(error?: unknown) => void` |

</details>
