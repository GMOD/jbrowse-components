import { getMembers } from '@jbrowse/mobx-state-tree'
import { untracked } from 'mobx'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

// This ESM package builds without @types/node, but consuming bundlers
// (webpack/vite) still string-replace `process.env.NODE_ENV`, so keep the
// reference and give it a minimal module-scoped type for tsc.
declare const process: { env: { NODE_ENV?: string } }

// Nodes whose fetch foundation has already installed its autoruns. Keyed on the
// node rather than the model type: every display of a type would otherwise
// report from the second instance onward.
const attached = new WeakSet<object>()

function report(message: string) {
  // `console.error`, never `throw`: an error escaping `afterAttach` is read by
  // the session loader as an invalid track and the display is silently dropped
  // — which would hide the very contract violation this is reporting.
  console.error(`[jbrowse display contract] ${message}`)
}

/**
 * Dev-only check that a display's fetch foundation attached it exactly once —
 * the one ordering contract here that is a *state* rather than a declaration,
 * so no selector can reach it. No-op in production.
 *
 * Called once per display from **whichever fetch foundation installed its
 * autoruns** — `MultiRegionDisplayMixin`'s `afterAttach` for the per-region
 * family, `installGlobalFetchAutorun` for the global one,
 * `installComparativeFetchAutorun` for the comparative one. Landing here twice
 * for one node means every autorun that foundation installs is installed twice:
 * double fetches, double clears, and nothing anywhere says so.
 *
 * The named cause is a display that chains to `super` in its own `afterAttach`
 * — our MST fork auto-chains lifecycle hooks, so the explicit call re-enters the
 * foundation's hook. **That cause is a declaration and could be a lint selector;
 * this check is not, because it is not the only cause**: composing two fetch
 * foundations onto one display, or calling an installer from a display that
 * already composes the mixin, arrives here the same way, through a composition
 * assembled across files that no single one of them spells out. So the message
 * leads with the common cause and then describes the state, not the syntax.
 *
 * `installedBy` names the caller so the message can describe the right thing;
 * the WeakSet is shared, which is correct — a display composes one fetch
 * foundation, so reaching here twice is the bug regardless of which.
 *
 * ARCHITECTURAL_LIMITS.md §"Ordering is the contract" is the authoritative
 * account of which contracts report themselves at runtime, which are lint
 * selectors and which are still silent; don't restate the split here, because
 * this comment said "four places" against a heading that said five and a list
 * that held six.
 *
 * Every message names the fix, not just the symptom — the failure modes here
 * cost hours precisely because the symptom (a wedged display, a stale cache)
 * points nowhere near the cause.
 */
export function assertDisplayContract(
  self: IAnyStateTreeNode,
  installedBy = "the per-region fetch foundation's afterAttach",
) {
  if (process.env.NODE_ENV !== 'production') {
    if (attached.has(self)) {
      report(
        `${getMembers(self).name}: ${installedBy} ran twice on one display, ` +
          `so its fetch autoruns are installed twice (double fetches, double ` +
          `clears). Our MST fork auto-chains lifecycle hooks, so the usual ` +
          `cause is a superAfterAttach() call in this display's afterAttach — ` +
          `delete it. Otherwise this display composes two fetch foundations, ` +
          `or calls an installer it already gets from a mixin. ` +
          `See agent-docs/ARCHITECTURE.md §"What not to do".`,
      )
    } else {
      attached.add(self)
    }
  }
}

/** What one run of a display's fetch autorun did. */
export type FetchAutorunOutcome =
  /** the display's own gate opened and a fetch started */
  | 'fetched'
  /** the gate stayed shut, so this run did nothing */
  | 'declined'
  /** a foundation gate skipped the run before the display's own was consulted */
  | 'gated'
  /**
   * The run stopped on something that re-wakes this autorun by itself, so it
   * answers nothing either way — the same deferral `awaitingPrerequisite` gets,
   * reached from inside the foundation rather than declared by the display. The
   * per-region family's in-flight-fetch skip is the case: `reload()` signals the
   * running fetch's stop token but `activeStopToken` clears in `runFetch`'s
   * finally, so the very next run can still see `isLoading` — and that fetch
   * ending bumps `fetchGeneration`, which the autorun tracks. Consuming the bump
   * there would answer the retry with a run that predates it.
   */
  | 'deferred'

interface RetryContractHost {
  reloadCounter: number
  fetchInert: boolean
  /**
   * Optional: the comparative family has no two-stage fetch, so nothing there
   * declares it. A family that grows one declares it and gets the deferral.
   */
  awaitingPrerequisite?: boolean
}

// Displays whose fetch has started since the last time the caller looked, and
// the ledger each of those nodes reports to. Both module-scope and keyed on the
// node for the same reason `attached` above is: the state is per display
// *instance*, and the code that needs it — `FetchMixin.runFetch`, a `.actions()`
// block, an `afterAttach` — cannot share a closure, because a mixin factory runs
// once per model type.
//
// The signal is `FetchMixin.runFetch`, the one place a fetch starts in every
// family, reached in the synchronous prefix of every one of the nine
// `fetchNeeded` overrides (directly, or through `fetchEachRegion` /
// `fetchAllRegions` / `fetchRegions`). The per-region foundation needs it because
// its gate is not a boolean it can read: `fetchNeeded` is an async action that
// returns the fetch's promise, and an override declines by returning early, which
// is indistinguishable from returning the promise of a fetch that has started.
//
// **A fetch answers an outstanding retry wherever `reload()` reached it from**,
// which is why `noteFetchStarted` tells the ledger rather than only setting a
// flag for the autorun to read. Canvas's `reload()` fetches directly — it clears
// and calls `fetchNeeded` itself instead of waiting out `FetchVisibleRegions`'
// 600ms debounce — so by the time that autorun runs, the blocks are covered and
// the run reads as a decline. Judging only from the autorun reports a dead button
// on the display with the liveliest one.
const fetchStarted = new WeakSet<object>()
const ledgers = new WeakMap<object, (outcome: FetchAutorunOutcome) => void>()

/** Called by `FetchMixin.runFetch`. Dev-only. */
export function noteFetchStarted(self: object) {
  if (process.env.NODE_ENV === 'production') {
    return
  }
  fetchStarted.add(self)
  ledgers.get(self)?.('fetched')
}

/** Reads and clears the flag above, so each check starts from a known state. */
export function takeFetchStarted(self: object) {
  return fetchStarted.delete(self)
}

/**
 * Dev-only check that a display's `reload()` can actually reach a fetch — the
 * retry contract, which `DisplayErrorBar` depends on and which no type can
 * state. No-op in production.
 *
 * **The button is the contract.** `DisplayErrorBar`'s only action is
 * `model.reload()`, so every state that can raise the error bar has to be one
 * `reload()` actually undoes; otherwise the button is present, looks live, and
 * does nothing. It has failed three times, and the shape this catches is the one
 * that recurs on its own: a gate that goes shut the moment data lands.
 * `GlobalFetchMixin.reload()` clears the error and bumps `reloadCounter`,
 * `installGlobalFetchAutorun` reads that counter unconditionally so the autorun
 * re-runs — and then the gate declines, because from its point of view nothing
 * has changed. Arc shipped exactly that: a `prepare` declining on `dataCurrent`,
 * with the error clearing on click and no arcs ever coming back. Its `reload()`
 * override drops `loadedRegionSignature` so `dataCurrent` goes false, which is
 * the fix this message asks for.
 *
 * Detected at the moment it happens rather than statically, because the relation
 * between `reload()` and the gate is semantic: a run that follows a
 * `reloadCounter` bump and declines to fetch IS the dead button.
 *
 * **The bump is the only thing that arms this**, so a `reload()` override that
 * neither bumps nor chains to super turns the whole check off for its display —
 * silently, and for as long as nobody reads the override. Canvas shipped in that
 * shape, which is two of the most-used displays in the product. What watches for
 * the next one is `MultiRegionDisplayMixin`'s `reloadReachesCounter.test.ts`,
 * which reads every `reload()` in the tree.
 *
 * **Both fetch foundations install it**, and what counts as the gate differs.
 * The global family's `prepare()` returns the fetch's args or `undefined`, so
 * its run classifies itself. The per-region family's gate is block coverage — a
 * `reload()` that invalidates nothing leaves `needed` empty — plus the
 * `fetchNeeded` override, which can decline inside an async body the foundation
 * cannot read a return value from. So `MultiRegionDisplayMixin` classifies on
 * whether the override reached `runFetch`, which every one of the nine does in
 * its synchronous prefix. An override that awaits before fetching would read as a
 * decline; there is no such override, and one added later gets a false report
 * rather than a silent gap, which is the right way round.
 *
 * **A fetch also answers the retry on its own** (`noteFetchStarted`), because
 * `reload()` may reach one without an autorun run in between: canvas's clears and
 * calls `fetchNeeded` directly rather than waiting out the 600ms debounce, and
 * the autorun's next run then finds the blocks covered.
 *
 * A display deliberately not fetching at all is the one exempt decline — LD with
 * the triangle off, whose `reload()` correctly does nothing because there is
 * nothing to load. That is already a named state: `fetchInert`, which the
 * loading scrim reads for the same reason, so the exemption is not a second
 * thing to remember. A display that suppresses the scrim and still wants the
 * retry checked has the two questions genuinely apart and should say so here.
 *
 * `awaitingPrerequisite` is not a second exemption — it is a *deferral*, and the
 * difference is the point. A two-stage `reload()` bumps the counter, wakes a
 * prerequisite fetch in another autorun, and declines here only until that
 * lands. HiC is the case: the contacts autorun runs first and declines because
 * `effectiveResolution` is still undefined, and the header arriving a moment
 * later wakes it again through the tracked read that declined. So the bump is
 * left outstanding instead of consumed, and the run after the prerequisite
 * lands is the one that has to reach a fetch — if it declines too, the report
 * lands then. A display cannot spend its retry on a decline it called
 * preliminary, which is what an exemption here would have let it do.
 * `fetchInert` is the wrong thing for HiC to say in any case, because it
 * does want the scrim while the header is re-read.
 *
 * Both flags are read off the node, and both are declared once on `FetchMixin`
 * — the one mixin all three display foundations compose. Neither foundation
 * passes them in: the global family's three phases are autorun options because
 * that is what they are, and these two are properties of the
 * display, which is why an earlier arrangement that made this one an option
 * there and a getter on the per-region mixin had one concept in two spellings.
 *
 * **The predicate has to be strictly narrower than the gate's own decline to be
 * a deferral at all.** One that restates the gate's negation makes every decline a
 * deferred one, so no run is ever judged and the display has opted out — an
 * exemption by another name. HiC's is that shape, because its gate and its
 * prerequisite are the same condition, and what covers HiC's retry instead is
 * `LinearHicDisplay/infoFetchFailure.test.ts`. Say so at any call site that
 * lands there, and pick a narrower predicate wherever one exists.
 *
 * **Everything it reads is `untracked`.** It runs inside the fetch autorun, so a
 * tracked read of `fetchInert` — or of whatever `awaitingPrerequisite`
 * reaches — would put that observable in the autorun's dependency set in dev and
 * not in production, a display whose fetch re-fires only in development, which
 * is worse than the bug being checked for.
 */
export function makeRetryContractCheck(
  self: IAnyStateTreeNode & RetryContractHost,
) {
  if (process.env.NODE_ENV === 'production') {
    return () => {}
  }
  let lastCounter = untracked(() => self.reloadCounter)
  function noteRetryContractOutcome(outcome: FetchAutorunOutcome) {
    untracked(() => {
      // A decline while a prerequisite is still in flight is a stage of the
      // retry, so the bump stays OUTSTANDING rather than being either reported
      // or forgotten — the run that follows the prerequisite landing is the one
      // that answers it, and if that run declines too the report lands then.
      // Deferring rather than exempting is what keeps the check's teeth here: a
      // display cannot spend its retry on a decline it called preliminary.
      if (outcome === 'deferred') {
        return
      }
      if (outcome === 'declined' && self.awaitingPrerequisite) {
        return
      }
      const retried = self.reloadCounter !== lastCounter
      // Consumed on every other outcome, `gated` included: a run the byte gate
      // skipped answers the retry legitimately (that banner offers Force load,
      // not Retry), and leaving the bump unconsumed would report against
      // whichever unrelated run cleared the gate later.
      lastCounter = self.reloadCounter
      if (retried && outcome === 'declined' && !self.fetchInert) {
        report(
          `${getMembers(self).name}: reload() bumped reloadCounter but the ` +
            `fetch autorun's gate still declines, so Retry is a dead ` +
            `button — it clears the error and nothing refetches. reload() has ` +
            `to invalidate whatever that gate reads, not just bump the ` +
            `counter (ArcFetchModel.reload drops loadedRegionSignature so its ` +
            `dataCurrent goes false). If this display is deliberately not ` +
            `fetching, say so with fetchInert — the loading scrim and the SVG ` +
            `export read it too; if this run declined only because a ` +
            `prerequisite fetch in another autorun has not landed, say so with ` +
            `awaitingPrerequisite and the retry is judged on the run after ` +
            `it does. See DISPLAYCHROME.md §"The retry contract".`,
        )
      }
    })
  }
  // So `noteFetchStarted` can answer an outstanding retry the moment a fetch
  // begins, whether or not an autorun run is what began it.
  ledgers.set(self, noteRetryContractOutcome)
  return noteRetryContractOutcome
}
