import { when } from 'mobx'

/**
 * Wait until a view has either initialized or failed, and report which.
 *
 * `initialized` folds in a view's assemblies, so an assembly that fails to load
 * leaves it false **forever**. A bare `when(() => view.initialized)` therefore
 * does not fail — it never settles at all, and whatever the caller meant to do
 * next simply never happens, with no error, no toast and a pending promise left
 * behind. That has surfaced twice now as two different-looking bugs: an SVG
 * export hung behind its dialog's spinner, and a launched breakpoint split view
 * that opened but was never navigated or zoomed.
 *
 * Every view exposes a resolved `error` beside `initialized`, so waiting on the
 * pair turns the hang into something reportable. What to report is the caller's,
 * because the vocabularies genuinely differ — an export says "cannot export"
 * and attaches its failures for `awaitSvgRenders` to collect, while a launcher
 * says the launch failed — which is why this returns the answer instead of
 * throwing one wording at both.
 *
 * No time bound, deliberately: `initialized || error` is a terminal pair, so a
 * slow-but-healthy remote assembly is waited out rather than guessed at.
 *
 * @returns true if the view initialized, false if it settled on an error
 */
export async function whenViewSettled(view: {
  initialized: boolean
  error: unknown
}) {
  await when(() => view.initialized || !!view.error)
  return view.initialized
}
