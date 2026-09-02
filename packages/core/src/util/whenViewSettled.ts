import { when } from 'mobx'

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
 * guessed at.
 *
 * @returns true if the view initialized (and consumed any launch), false if it
 * settled on an error
 */
export async function whenViewSettled(view: {
  initialized: boolean
  error: unknown
  pendingLaunch?: unknown
}) {
  const ready = () => view.initialized && view.pendingLaunch === undefined
  await when(() => ready() || !!view.error)
  return ready()
}
