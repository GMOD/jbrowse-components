import { when } from 'mobx'

// `error` is required, and that is the type doing the same job as the lint
// selector: a caller whose view has no resolved `error` beside `initialized`
// would reduce `done` back to the one-sided predicate this module exists to
// replace, and would do it while reading as a fix.
export interface SettleableView {
  initialized: boolean
  error: unknown
  pendingLaunch?: unknown
}

const consumed = (view: SettleableView) =>
  view.initialized && view.pendingLaunch === undefined

const done = (view: SettleableView) => consumed(view) || !!view.error

/**
 * Wait until a view has either initialized — launch blob consumed and all — or
 * failed, and report which.
 *
 * `initialized` folds in a view's assemblies, so an assembly that fails to load
 * leaves it false **forever**. A bare `when(() => view.initialized)` therefore
 * does not fail — it never settles at all, and whatever the caller meant to do
 * next simply never happens, with no error, no toast and a pending promise left
 * behind. That has surfaced twice now as two different-looking bugs: an SVG
 * export hung behind its dialog's spinner, and a launched breakpoint split view
 * that opened but was never navigated or zoomed.
 *
 * `pendingLaunch` is the other half, and it matters because `initialized` can
 * go true MID-launch: LGV's flips the moment displayedRegions land, while the
 * same apply pass still has tracks to attach — so a caller acting there reads a
 * positioned view with its tracks missing (an SVG export saves it that way).
 * A launch failure cannot hang this: the state machine either clears the blob
 * (materialized, reported as a snackbar) or sets the view's `error`
 * (installInitAutorun's failure policy). A view with no launch machinery has no
 * `pendingLaunch` and the term is vacuously satisfied.
 *
 * Every view exposes a resolved `error` beside `initialized`, so waiting on the
 * pair turns the hang into something reportable. What to report is the caller's,
 * because the vocabularies genuinely differ — an export says "cannot export"
 * and attaches its failures for `awaitSvgRenders` to collect, while a launcher
 * says the launch failed — which is why this returns the answer instead of
 * throwing one wording at both.
 *
 * No time bound, deliberately: `(initialized && launch consumed) || error` is a
 * terminal set, so a slow-but-healthy remote assembly is waited out rather than
 * guessed at. `escape` is how a caller adds the one term that is not the view's
 * own — a session-level render failure for an export, `superseded` for a view
 * an `installInitAutorun` apply is waiting on — which is what keeps a caller
 * from re-spelling the whole predicate around it.
 *
 * **Not for the view whose `apply` you are inside.** `applyInitOnce` clears the
 * launch blob only after awaiting `apply`, so `pendingLaunch` is held for the
 * whole of it and this can end only on `escape` or `error`, never on success.
 * A wait on `self` stays hand-rolled; `reference/VIEW_INIT.md` has the shape.
 *
 * @returns true if the view initialized (and consumed any launch), false if it
 * settled on an error
 */
export async function whenViewSettled(
  view: SettleableView,
  escape: () => boolean = () => false,
) {
  await when(() => escape() || done(view))
  return consumed(view)
}

/**
 * The same wait over several views at once — a synteny view's genome rows. An
 * SVG export of a split view keeps its own per-panel loop instead: the split
 * view's `initialized` folds in `views.every(v => v.initialized)` but not each
 * panel's own `pendingLaunch`, so that loop is waiting on a different question
 * by the time it runs.
 *
 * One predicate over `every`, never `Promise.all` of the single form: `when`
 * returns a cancellable promise, so racing N of them against an escape leaves
 * N-1 live reactions behind on the path that escapes. This is one reaction with
 * nothing to cancel.
 *
 * @returns true if every view initialized, false if any settled on an error or
 * the escape fired
 */
export async function whenViewsSettled(
  views: SettleableView[],
  escape: () => boolean = () => false,
) {
  await when(() => escape() || views.every(done))
  return views.every(consumed)
}
