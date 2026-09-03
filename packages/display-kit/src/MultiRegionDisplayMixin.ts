import { getSession } from '@jbrowse/core/util/mstUtils'
import { types } from '@jbrowse/mobx-state-tree'
import { RenderLifecycleMixin } from '@jbrowse/render-core/RenderLifecycleMixin'
import { regionDataMap } from '@jbrowse/render-core/regionDataMap'
import { buildRenderBlocks } from '@jbrowse/render-core/renderBlock'

import FetchMixin from './FetchMixin.ts'
import RegionTooLargeMixin from './RegionTooLargeMixin.ts'
import { foundationDisplayPhase } from './foundationDisplayPhase.ts'
import { foundationPaintInert } from './foundationPaintInert.ts'
import { foundationSvgReady } from './foundationSvgReady.ts'
import { containingHost, foundationCanRender } from './foundationView.ts'
import { installPerRegionFetchAutoruns } from './installPerRegionFetchAutoruns.ts'
import { isBlockCovered } from './planRegionFetch.ts'
import { makeCommitChecks } from './regionCommit.ts'
import { viewportEmpty } from './viewportEmpty.ts'

import type { IndexedRegion } from './planRegionFetch.ts'
import type { LoadedRegion, RegionFetchContext } from './regionCommit.ts'
import type { RegionHost } from './regionHost.ts'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Region } from '@jbrowse/core/util/types/data'
import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'

/**
 * #stateModel MultiRegionDisplayMixin
 * #displayFoundationDef Per-region fetch + render: the fetch autoruns, `rpcProps()` refetch wiring, and byte gating. The common case.
 * #category display
 *
 * Per-region fetch lifecycle for LGV-based GPU displays. Installs the fetch
 * autoruns in `afterAttach` and exposes overridable hooks (`fetchNeeded`,
 * `rpcProps`, `regionFetchKey`, `regionHasData`, `gateEnabled`) plus
 * the `fetchRegions` / `loadedRegions` machinery.
 */
export default function MultiRegionDisplayMixin() {
  return (
    types
      .compose(
        'MultiRegionDisplayMixin',
        RegionTooLargeMixin(),
        RenderLifecycleMixin(),
        FetchMixin(),
        types.model({}),
      )
      .volatile(() => ({
        /**
         * #volatile
         * regions whose data has been fetched and committed, keyed by
         * displayedRegionIndex; populated only after the fetch work callback
         * returns
         */
        loadedRegions: regionDataMap<LoadedRegion>('loadedRegions'),
      }))
      .views(self => ({
        /**
         * #getter
         * The containing LinearGenomeView, typed once for every display in this
         * family — see `containingHost` for the cast it owns and why both
         * foundations still declare the name.
         */
        get host(): RegionHost {
          return containingHost(self)
        },

        /**
         * #getter
         * The CSS width of this display's on-screen canvas, in px — and the
         * `canvasWidth` its `renderState` must carry, since the two have to
         * agree or the bp→px mapping is scaled against a box it doesn't fill.
         *
         * `trackWidthPx`, **not** `view.width`: `TrackRenderingContainer` insets
         * the rendering component by the 2px track outline under
         * `contain: strict`, so a `view.width`-wide canvas overhangs its own
         * container and the browser clips the overhang away. It renders almost
         * identically, which is why MAF drifted onto `view.width` uncaught.
         *
         * A getter rather than a note on each display, because the choice was
         * being made by copying a neighbour out of four plausible view getters —
         * `width` (the viewport), this one, and `totalWidthPx` /
         * `totalWidthPxWithoutBorders` (the *content* width, which the global
         * family's heatmaps legitimately want: a different question, not a
         * different answer). `no-restricted-syntax` bans the underlying read
         * everywhere but this line, since a second spelling agrees until it
         * doesn't.
         *
         * SVG export is the one exception: the export shell has no outline, so
         * `renderSvg` overrides `canvasWidth` with the shell's own width (see
         * `LgvSvgBodyProps`).
         */
        get canvasWidthPx(): number {
          return this.host.trackWidthPx
        },

        /**
         * #getter
         * Overrides `RenderLifecycleMixin`'s default-true hook with the LGV
         * precondition both foundations share — see `foundationCanRender`.
         */
        get canRender() {
          return foundationCanRender(this)
        },

        /**
         * #getter
         * Fills `RenderLifecycleMixin`'s hook off `fetchInert`, as
         * `GlobalFetchMixin` does: a display that will never fetch here shows a
         * placeholder where its canvas would be.
         */
        get rendersCanvas(): boolean {
          return !self.fetchInert
        },

        /**
         * #getter
         * true when every visible block lies within an already-fetched region —
         * i.e. the viewport shows data we actually loaded, not the stale fringe
         * left after a zoom-out/pan. Drives the loading overlay through the
         * pre-refetch debounce.
         *
         * **Spatial only, and it stays that way.** Whether the data held for a
         * block is still what a fetch would bring back is `isCacheValid`, which
         * `dataCurrent` conjoins for the export gate. The scrim reads this
         * getter and `dataSuperseded`, never `isCacheValid`: a phase that went
         * `loading` on a moved `regionFetchKey` would raise the overlay into
         * every zoom.
         */
        get viewportWithinLoadedData() {
          const view = this.host
          return view.initialized
            ? view.visibleRegions.every(block =>
                isBlockCovered(
                  self.loadedRegions.get(block.displayedRegionIndex),
                  block,
                ),
              )
            : false
        },

        /**
         * #getter
         * No content block is on screen, so this display has nothing to fetch
         * and nothing to paint — see `viewportEmpty.ts` for the one viewport that
         * reaches it, how narrow that is, and why the state still has to be
         * terminal rather than a permanent scrim. Both foundations declare it
         * over that one expression, the same way they each declare `host` and
         * `paintInert`.
         */
        get viewportEmpty(): boolean {
          return viewportEmpty(this.host)
        },

        /**
         * #getter
         * Overridable hook (default false), read by the fetch plan: the display
         * is drawing something in the features' place and wants no fetch while
         * it does. `DensityTierMixin` says it while the band is up and the gate
         * is not blocking, so a track forced to `density` never downloads the
         * features it will not draw, while a refused viewport keeps its
         * measurement pass and the gate can still release.
         *
         * Not `fetchInert`: that one suppresses the scrim and ends the export
         * wait, and a display saying this still has its stand-in to load. On
         * this foundation alone, because only this family's plan reads it.
         */
        get fetchSuspended(): boolean {
          return false
        },

        /**
         * #getter
         * Overridable hook (default false): whether a searchable feature layout
         * currently exists. Any display defining a feature-lookup method
         * (`searchFeatureByID`, `getFeatureById`) must override it, so callers can
         * tell "laid out, but off-display" from "no layout exists yet" — a
         * distinction only the display can make. See
         * packages/display-kit/CLAUDE.md §"Four
         * readiness axes".
         */
        get layoutReady(): boolean {
          // fail-safe: forgetting the override drops overlays (visibly absent)
          // rather than pinning them to one edge (a plausible lie)
          return false
        },

        /**
         * #getter
         * Overridable hook (default `''`): the zoom-dependent term of what a
         * fetch issued right now would produce for a region — the one axis of
         * the fetch key the display supplies, where the settings and adapter
         * axes are the mixin's (`regionFetchKey` below). Wiggle returns
         * `String(view.bpPerPx)` (adr-008), canvas the peptide-overlay
         * threshold, the variant matrix its zoom in matrix mode only,
         * alignments its per-base sampling bin.
         *
         * Here and NOT in `rpcProps()`: a zoom-swinging value in the RPC
         * payload runs `SettingsInvalidate` on every crossing — the in-flight
         * fetch superseded, the scrim raised over the held data, and the
         * display blanked where it drops settings-baked data — see
         * REGION_TOO_LARGE.md §"How the verdict is built" — where a key term
         * marks the held regions stale and lets them draw, unscrimmed, until
         * the refetch lands.
         *
         * A getter, so the observables it reads register as dependencies of
         * `FetchVisibleRegions`; MobX runs an action untracked and the autorun
         * would keep a stale answer.
         */
        get zoomFetchKey(): string {
          return ''
        },

        /**
         * #method
         * Overridable hook (default true): whether the display can actually
         * draw what this region is marked loaded over. Two different displays
         * want it for two different reasons, and both are real:
         *
         * - **The reader-side check of the write-side rule.** `loadedRegions` is
         *   written where the payload is stored (`RegionFetchContext`), so an
         *   entry with nothing behind it means that rule was broken somewhere.
         *   Answering off the data map costs a lookup and decides which way the
         *   break fails: a refetch, or a viewport that reads as covered against
         *   data nobody has and never asks again. Both canvas displays.
         * - **Which of several held payloads answers.** MAF caches a summary
         *   tier and a detail tier side by side under one
         *   `displayedRegionIndex`, so crossing the threshold inside an
         *   already-loaded region changes which map has to answer — something
         *   the coverage bounds cannot see at all.
         *
         * Separate from `regionFetchKey` on purpose: for MAF a key would refetch
         * the summary on every zoom back out, since both tiers are still held.
         * And the mixin cannot see a display's data map, so a key that changed
         * when data arrived would be the `rpcProps()` loop in different clothes.
         *
         * **The fail-open default is load-bearing, not an omission.** A
         * byte-gate refusal never marks a region loaded (the commit sits beside
         * the store and skips refused results), so "marked loaded with nothing
         * behind it" is unreachable from the gate — the one path that stamps
         * without storing is sequence's legitimately-empty-region answer, and a
         * store-derived default there would refetch forever: stamp, store
         * nothing, read uncovered, fetch again. `true` is what lets "this fetch
         * completed and there is genuinely nothing here" be a terminal state.
         *
         * A view, not an action, for the reason `regionFetchKey` is a getter.
         */
        regionHasData(_displayedRegionIndex: number): boolean {
          return true
        },

        /**
         * #getter
         * Overridable hook (default false): the held data is loaded and covers
         * the viewport, but a fetch input has moved past it, so the data is
         * about to be refetched. A display says so here rather than overriding
         * `dataCurrent`, for the reason `FetchMixin.fetchInert` is a hook: an
         * override has to restate the freshness terms and then misses the next
         * one added.
         *
         * Both answers a display gives about being finished read it — the
         * export gate through `dataCurrent`, the loading scrim through
         * `displayPhase`. The export gate is the sharper case: `awaitSvgReady`
         * samples freshness once, and an export that samples it inside this
         * window renders the data that is about to be replaced. GWAS's LD
         * auto-index is that case: adopting the top hit as the index SNP is an
         * `rpcProps` change, so the very load that produced the top hit is what
         * it invalidates — and `SettingsInvalidate` lands a tick after the
         * write, so until it does not even `staleSettingsDrawn` has seen it.
         *
         * The window is NOT invisible on screen, which this used to say while
         * `displayPhase` took a spatial-only argument: alignments' per-base
         * wall spends the debounce plus the RPC painting a 1 px stripe every
         * 8 px, with nothing in the key having moved yet.
         *
         * **The input need not have settled yet.** Alignments counts the
         * debounce window ahead of its per-base bin, where the bin the data was
         * fetched under has not moved and the clear is inevitable rather than
         * committed. That is the half of the window an export lands in, since a
         * reader zooms and then reaches for the menu. What may NOT go in is a
         * change that could still be taken back: this fails hung, not stale.
         *
         * So state the live-vs-settled half as a **value** compare and leave key
         * strings alone. The settled half — the stamp a fetch committed under
         * against the key a fetch now would use — is the foundation's already,
         * through the `isCacheValid` term in `dataCurrent`, and an override
         * restating it buys nothing: a second derivation of the key's vocabulary
         * reads `"16|fine"` against a live `"16"` the day the key grows an axis,
         * latches this true, and every export of the display then waits out
         * `awaitSvgReady`'s backstop instead of failing.
         */
        get dataSuperseded(): boolean {
          return false
        },

        /**
         * #getter
         * Shared cached view for every LGV-based GPU display. A single
         * displayedRegion may produce multiple render blocks (shared GPU
         * buffer, different scissor clips on screen). Plugins that want to
         * suppress rendering in certain states (e.g. no domain yet) can
         * override this getter to return [] — the autorun lifecycle will
         * then issue an empty-blocks render that clears the canvas.
         */
        get renderBlocks() {
          return buildRenderBlocks(this.host.visibleRegions)
        },
      }))
      // A pure read of view/display state, read from the `FetchVisibleRegions`
      // autorun. It is a **view, not an action**, deliberately: MobX runs an
      // action inside `untracked`, so as an action its `view.bpPerPx` read
      // registered no dependency and the caller silently kept a stale answer.
      // That worked only by accident — the autorun happened to read
      // `view.visibleRegions`, which moves in lockstep — which made "don't let
      // this be your only dependency" an unwritten precondition on every
      // override. `zoomFetchKey` and `regionHasData` are views for the same
      // reason.
      .views(self => ({
        /**
         * #getter
         * The settings axis (`rpcPropsCacheKey`) and the adapter axis
         * (`adapterConfigKey`) of `regionFetchKey`: everything a fetch issued
         * right now would stamp on a region except the zoom. Stamped beside
         * the whole key (`LoadedRegion.settingsKey`) so `staleSettingsDrawn`
         * can compare these two axes alone.
         */
        get settingsFetchKey(): string {
          return `${self.rpcPropsCacheKey}|${self.adapterConfigKey}`
        },
      }))
      .views(self => ({
        /**
         * #getter
         * What a fetch issued right now would stamp on a region:
         * `settingsFetchKey` plus the display's zoom term (`zoomFetchKey`).
         * `fetchRegions` captures it before the RPC goes out and stamps it
         * beside the loaded region; `isCacheValid` compares against it. The
         * same three axes the global family's `currentFetchKey` carries, so a
         * settings change reads as stale here through the one compare — which
         * is what closes the export gate on a setting the way it closes on a
         * zoom, and what lets `SettingsInvalidate` keep the coverage map.
         */
        get regionFetchKey(): string {
          return `${self.settingsFetchKey}|${self.zoomFetchKey}`
        },
        /**
         * #method
         * Whether the data held for a region still answers the current view.
         * Not a hook a display fills: a display states its rule as
         * `zoomFetchKey` (the zoom term of what a fetch now would produce) and
         * `regionHasData` (did the last one store anything), and this compares
         * the whole key against the one the region was fetched under. A
         * subclass that changes what it fetches spells the change in the key,
         * and one that forgets gets a redundant fetch rather than a cached
         * answer for a zoom the data was never fetched at.
         *
         */
        isCacheValid(displayedRegionIndex: number): boolean {
          return (
            self.regionHasData(displayedRegionIndex) &&
            self.loadedRegions.get(displayedRegionIndex)?.fetchKey ===
              this.regionFetchKey
          )
        },
      }))
      // `dataCurrent` and `svgReady` sit in their own blocks, after everything
      // they read, so each reads its siblings off `self` rather than `this`.
      // Same shape as `GlobalFetchMixin`, and for the reason in CLAUDE.md ("a
      // super-captured view is called bare"): a subclass that captures one of
      // these and calls it with no receiver would get `undefined` for a `this`
      // sibling. Nothing captures them today; the split is what keeps that true
      // by construction instead of by luck.
      .views(self => ({
        /**
         * #getter
         * A visible block's held data was fetched under a settings or adapter
         * key that has since moved: drawn, and wrong for the current settings,
         * until the refetch `isCacheValid` already owes lands. The loading
         * scrim's third staleness term, beside spatial coverage and
         * `dataSuperseded` — the one that used to come from `SettingsInvalidate`
         * emptying the coverage map, and the reason it no longer has to.
         *
         * False on a zoom by construction: `LoadedRegion.settingsKey` is the
         * key minus its zoom axis, so a moved `zoomFetchKey` raises no scrim.
         * That is the whole distance from the fold REJECTED_IDEAS.md "Folding
         * content staleness into `displayPhase`" declines, which compared the
         * whole key and put the overlay 250 ms into every zoom.
         */
        get staleSettingsDrawn(): boolean {
          const { host } = self
          const settingsKey = self.settingsFetchKey
          return (
            host.initialized &&
            host.visibleRegions.some(block => {
              const loaded = self.loadedRegions.get(block.displayedRegionIndex)
              return loaded !== undefined && loaded.settingsKey !== settingsKey
            })
          )
        },
        /**
         * #getter
         * This family's answer to the shared freshness question every display
         * foundation must answer (`dataCurrent`): the held data corresponds to
         * what is on screen right now. Four terms — spatial coverage of every
         * visible block, `loadedRegions.size` to rule out the vacuously-true
         * empty viewport, `isCacheValid` per block, and the display's own
         * `dataSuperseded`. Regions stream in one at a time, so this (not "the
         * first datum arrived") is what keeps a multi-region/whole-genome export
         * complete.
         *
         * **`isCacheValid` belongs here and not in the scrim.** Coverage answers
         * "is the data here", never "is it what a fetch now would bring back", so
         * a zoom that moves `regionFetchKey` leaves every held region covered and
         * stale at once — and an export sampling `svgReady` across that window
         * painted bins the worker computed for the previous zoom. `displayPhase`
         * takes `dataSuperseded` but NOT this term: folding a moved
         * `regionFetchKey` into the phase raises the loading scrim into every
         * zoom, which is the trade REJECTED_IDEAS.md "Folding content staleness
         * into `displayPhase`" turned down and this does not take.
         *
         * The term cannot latch, and the reason is structural rather than a case
         * list: a block reaches `fetchNeeded` unless `planRegionFetch` finds it
         * ungated, covered AND cache-valid, and it reads that last term tracked.
         * The `&&` short-circuits ahead of it drop its observables only where the
         * block is fetched anyway, so the key move that closes this gate is the
         * same read, in the same dependency set, that wakes the refetch reopening
         * it.
         */
        get dataCurrent(): boolean {
          return (
            self.viewportWithinLoadedData &&
            self.loadedRegions.size > 0 &&
            self.host.visibleRegions.every(block =>
              self.isCacheValid(block.displayedRegionIndex),
            ) &&
            !self.dataSuperseded
          )
        },

        /**
         * #getter
         * The assembly the data in hand came from, once it can answer about
         * refNames — `undefined` before that.
         *
         * Off the first LOADED region rather than the view's displayed ones,
         * which is the distinction that makes it belong here: a display holding
         * fetched data is asking about the assembly THAT data is on, and the
         * view's regions can already have moved on.
         *
         * The `initialized` gate is why this returns the assembly rather than
         * its name. `getCanonicalRefName2` and `refNameToIndex` answer WRONGLY
         * rather than throwing before the aliases land — identity, and a miss —
         * so a caller that skips the gate gets a plausible answer and no signal.
         * Handing back `undefined` until it can answer is what makes the caller
         * write its fallback.
         */
        get loadedAssembly(): Assembly | undefined {
          const firstRegion = self.loadedRegions.values().next().value
          const assembly = firstRegion
            ? getSession(self).assemblyManager.get(firstRegion.assemblyName)
            : undefined
          return assembly?.initialized ? assembly : undefined
        },
      }))
      .views(self => ({
        /**
         * #getter
         * true once an off-screen (SVG) export can safely read this display's
         * data. Policy single-sourced in `computeSvgReady`; this family supplies
         * only the freshness half, which `foundationSvgReady` reads as
         * `dataCurrent` or the vacuous currency of `viewportEmpty`. Off-screen
         * renderers gate on it via `awaitSvgReady(model)` instead of inlining
         * the condition.
         */
        get svgReady(): boolean {
          return foundationSvgReady(self)
        },

        /**
         * #getter
         * Fills `RenderLifecycleMixin`'s `paintInert` hook — see there for why a
         * failed fetch has to read as finished to the consumers outside the
         * display, and `foundationPaintInert` for the second such state and why
         * both fetch families answer it through one function. Overridable, as
         * the hook is: a display with a third inert state of its own says so
         * here.
         */
        get paintInert(): boolean {
          return foundationPaintInert(self)
        },
        /**
         * #getter
         * Fills `RenderLifecycleMixin`'s hook with `staleSettingsDrawn`, so
         * `painted` — and `data-display-drawn` through it — reads pending over
         * a canvas painted under the previous settings until the refetch
         * lands. `clearAllRpcData` used to reset `canvasDrawn` for the same
         * effect; the hook says it without blanking anything.
         */
        get paintSuperseded(): boolean {
          return self.staleSettingsDrawn
        },

        /**
         * #getter
         * The display's mutually-exclusive visual state, mapped in
         * `foundationDisplayPhase` — every foundation calls it and supplies only
         * its staleness argument, so a term added to `computeLoadingTerm`
         * reaches all three without being wired three times.
         *
         * This family's argument is spatial coverage AND `dataSuperseded`: stale
         * data (viewport past loaded) still on screen through the pre-refetch
         * debounce, plus data a settled fetch-input change is about to
         * invalidate, which is being drawn wrong RIGHT NOW rather than merely
         * about to be. Alignments is the second case — zooming perBaseLetter
         * from 16 bp/px to 1 keeps the viewport inside the loaded region, so a
         * spatial-only argument reported `ready` over a wall drawn as a 1 px
         * stripe every 8 px for the whole debounce-plus-RPC window.
         *
         * **It is deliberately NOT `dataCurrent`**, which the export gate takes.
         * That one also carries `isCacheValid`, and folding a moved
         * `regionFetchKey` into the phase raises the loading scrim 250 ms into
         * every ordinary zoom — the trade REJECTED_IDEAS.md "Folding content
         * staleness into `displayPhase`" turned down, and which
         * `displayPhaseWiring.test.ts` guards. `dataSuperseded` is the half that
         * does belong: it is a settled value compare a display opts into, false
         * on every display that does not.
         *
         * A thunk, so a suppressed or already-loading display doesn't subscribe
         * to viewport churn.
         *
         * A subclass customizes this through `fetchInert` (FetchMixin),
         * never by overriding the getter — see that hook.
         */
        get displayPhase(): DisplayPhase {
          return foundationDisplayPhase(
            self,
            () =>
              self.viewportWithinLoadedData &&
              !self.dataSuperseded &&
              !self.staleSettingsDrawn,
            () => self.host.effectiveBodyMounted,
          )
        },
      }))
      .actions(self => ({
        /**
         * #action
         * The raw write behind `ctx.commitRegion`, and **not what a fetch should
         * call**: a display naming its own span is the bug this family spent a
         * release on, and going through the context is what makes that
         * inexpressible — see {@link RegionFetchContext}. Direct callers are
         * tests staging an already-loaded display.
         *
         * An action so callers after an async boundary stay in MST strict mode.
         * Stamps the region with the fetch key its data came back under.
         * `fetchRegions` passes the key it captured before issuing the RPC; the
         * default reads it *now*, which is right for a caller holding the region
         * already and wrong for anything resuming after an await, where the
         * viewport may have moved under the fetch.
         */
        setLoadedRegion(
          displayedRegionIndex: number,
          region: Region,
          // annotated, not inferred: `self` here is mid-composition, so the
          // default's type lands as `any` and the published signature stopped
          // constraining the one field `isCacheValid` compares
          fetchKey: string = self.regionFetchKey,
          settingsKey: string = self.settingsFetchKey,
        ) {
          self.loadedRegions.set(displayedRegionIndex, {
            ...region,
            fetchKey,
            settingsKey,
          })
        },

        /**
         * #action
         * Forget one region — for a display pruning what has scrolled off
         * screen.
         */
        dropLoadedRegion(displayedRegionIndex: number) {
          self.loadedRegions.delete(displayedRegionIndex)
        },

        /**
         * #action
         * Overridable hook (no-op base): drop this display's own stores —
         * `rpcDataMap` and whatever sits beside it. Called by
         * `clearAllRpcData`, which runs on a displayed-regions change, on a
         * viewport move past an error or a cancel, and on `reload()`.
         */
        clearDisplaySpecificData() {},
        /**
         * #action
         * Overridable hook (no-op base): drop what this display holds that is
         * wrong under a changed setting rather than merely stale — a payload
         * whose shape the setting decides. Called by `invalidateSettings`,
         * where `clearDisplaySpecificData` is deliberately not: bins, reads
         * and features fetched under the previous setting draw honestly under
         * the scrim `staleSettingsDrawn` raises until the refetch lands, the
         * way canvas has kept its features since ADR-006 and every display
         * does since 2026-09.
         *
         * Two displays override it, for two structural reasons. The variant
         * matrix holds one payload for every visible region and the row set
         * is a setting, so there is no per-region replacement to wait for.
         * MAF holds a summary tier and a detail tier under one
         * `displayedRegionIndex` with one stamp between them: a refetch under
         * the new setting restamps the region for the tier it fetched, and the
         * other tier's map — still the old setting's rows — would then read as
         * cache-valid on the next zoom across the threshold.
         */
        clearSettingsBakedData() {},
      }))
      .actions(self => {
        const superReload = self.reload
        return {
          /**
           * #action
           * full reset: cancels fetch, clears error, loadedRegions,
           * display-specific data, and the canvas-drawn flag. The too-large gate is
           * derived (a pure function of the cached estimate × viewport), so it needs
           * no explicit clear here — the fetch autorun re-measures at the new
           * viewport and the verdict follows.
           */
          clearAllRpcData() {
            self.cancelFetch()
            self.setError(undefined)
            self.loadedRegions.clear()
            self.clearDisplaySpecificData()
            self.resetCanvasDrawn()
          },

          /**
           * #action
           * `SettingsInvalidate`'s reset: the half of `clearAllRpcData` a
           * settings change still needs now that the settings and adapter
           * axes are in `regionFetchKey`. The in-flight fetch is superseded
           * now rather than when its payload lands stamped stale, a blocking
           * error or cancel is cleared so the plan is not `blocked`, and the
           * display drops its settings-baked data. `loadedRegions` and the
           * canvas-drawn flag stay: every held region already reads
           * `!isCacheValid`, so the plan refetches it, and until that lands the
           * data stays on screen under the scrim `staleSettingsDrawn` raises.
           */
          invalidateSettings() {
            self.cancelFetch()
            self.setError(undefined)
            self.clearSettingsBakedData()
          },

          /**
           * #action
           * `FetchMixin.reload` (error, cancel, counter) plus the full reset.
           * Subclasses with extra teardown override and chain.
           *
           * An override must reach this counter, by chaining to super or by
           * bumping it. Missing it doesn't break the retry, which the
           * `clearAllRpcData` call drives; it turns the retry contract check off
           * for that display, silently. Both overrides in the tree chain now —
           * `MultiSampleVariantBaseModel` always did, canvas's `LinearBasicDisplay`
           * did not, and that took `LinearVariantDisplay` with it — and
           * `reloadReachesCounter.test.ts` reads every `reload()` in the tree
           * rather than leaving the next one to this paragraph.
           */
          reload() {
            superReload()
            this.clearAllRpcData()
          },
        }
      })
      .actions(_self => ({
        /**
         * #action
         * Overridable hook (no-op base): override to call one of the three
         * helpers in `fetchEachRegion.ts` — `fetchEachRegion` (one RPC per
         * region), `fetchAllRegions` (one RPC, one result per region) or
         * `fetchRegionsBatched` (one RPC, one payload covering all of them).
         */
        fetchNeeded(_needed: IndexedRegion[]) {
          // no-op base
        },
      }))
      .actions(self => {
        const checks = makeCommitChecks(self)
        return {
          /**
           * #action
           * Run a per-region fetch. The work callback
           * calls `ctx.commitRegion` as it stores each region's payload, which is
           * what marks it loaded — see {@link RegionFetchContext} for why this
           * function no longer does that itself. Its only callers are the three
           * helpers in `fetchEachRegion.ts`, which make that call for every
           * display in the family; a display reaching past them owns both
           * `ctx.isStale()` guards and the commit by hand, and none does.
           *
           * The fetch key is captured here, at issue, and carried into every
           * commit — never re-read after the await. `ctx.isStale()` trips on a
           * newer fetch or a cancel, not on a viewport that moved under a fetch
           * that is still current, so a key read at commit time would stamp this
           * data with a zoom it was not fetched at.
           */
          async fetchRegions(
            needed: IndexedRegion[],
            work: (ctx: RegionFetchContext) => Promise<void>,
          ) {
            const fetchKey = self.regionFetchKey
            const settingsKey = self.settingsFetchKey
            const issued = new Map(
              needed.map(n => [n.displayedRegionIndex, n.region]),
            )
            await self.runFetch(async ctx => {
              let committed = 0
              await work({
                ...ctx,
                commitRegion: displayedRegionIndex => {
                  // The span is the one this fetch asked for, looked up rather
                  // than taken from the caller — see RegionFetchContext. An
                  // index that is not in it has no span to be honest about, so
                  // the commit is dropped: under-claiming costs a refetch, and
                  // the alternative is the claim this mechanism exists to
                  // prevent.
                  const region = issued.get(displayedRegionIndex)
                  if (region === undefined) {
                    checks.unknownRegion(displayedRegionIndex, issued.keys())
                  } else if (!ctx.isStale()) {
                    committed++
                    self.setLoadedRegion(
                      displayedRegionIndex,
                      region,
                      fetchKey,
                      settingsKey,
                    )
                  }
                },
              })
              // `|| regionTooLarge` so a refusal batch still reaches the check
              // — it is stale by then, and the streak this resets counts
              // fetches that stored nothing with NOTHING gating them. Widening
              // only ever resets: a gated run cannot increment. It gets there
              // for a single-region display, or once every sibling landed;
              // `cancelFetch` rejects `work(...)`, so an aborted sibling skips
              // the check and only leaves its batch's reset undone.
              if (
                needed.length > 0 &&
                (!ctx.isStale() || self.regionTooLarge)
              ) {
                checks.fetchEnded({ committed, gated: self.regionTooLarge })
              }
            })
          },
        }
      })
      .actions(self => ({
        /**
         * #action
         * installs the fetch-lifecycle autoruns (DisplayedRegionsChange,
         * FetchVisibleRegions, SettingsInvalidate,
         * ClearBlockingStateOnViewportChange)
         */
        afterAttach() {
          installPerRegionFetchAutoruns(
            // `clearHoveredFeature` is `BaseDisplay`'s and this mixin does not
            // compose it — the same shape as `WiggleScoreConfigMixin`'s
            // `confNode(self)`, and the cast names exactly what is read.
            self as typeof self & { clearHoveredFeature: () => void },
          )
        },
      }))
  )
}

export type MultiRegionDisplayMixinType = ReturnType<
  typeof MultiRegionDisplayMixin
>
