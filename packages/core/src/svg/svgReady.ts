import { when } from 'mobx'

/**
 * The contract every GPU display's `renderSvg` relies on: a `svgReady` gate
 * (the per-display terminal-state getter — see MultiRegionDisplayMixin /
 * GlobalDataDisplayMixin) and the `error` it renders through `SVGErrorBox`.
 * Duck-typed `renderSvg` model interfaces extend this so the compiler catches a
 * missing field instead of it surfacing as a runtime hang or a silent blank.
 */
export interface SvgExportable {
  svgReady: boolean
  error: unknown
  // the too-large terminal state; `SvgChrome` renders it as a message box so an
  // over-budget region exports a labeled note instead of a silent blank.
  regionTooLarge: boolean
}

/**
 * The terminal states that let an export proceed with no current data. Mirrors
 * `DisplayPhaseInputs`: named fields, all required, so adding a state is a
 * compile error at every call site rather than a silently missing branch.
 *
 * `extraTerminal` is the display-specific escape hatch — sequence sets it when
 * zoomed past base resolution, where it renders a static "zoom in" message and
 * fetches nothing, so a data-only gate would never resolve.
 */
export interface SvgReadyTerminals {
  error: unknown
  regionTooLarge: boolean
  extraTerminal: boolean
}

/**
 * Whether an off-screen (SVG) export can read this display's data now: the held
 * data is current for what is on screen, or the fetch reached a terminal state.
 *
 * Single-sourced for the same reason as `computeDisplayPhase`: every display
 * family expresses freshness differently — spatial coverage (per-region),
 * viewport-snapshot compare (global), signature compare (arc / dotplot /
 * synteny) — but the *policy* wrapping it is identical, and each of the five
 * hand-written copies this replaced was one place to forget a terminal and hang
 * the export, or to forget freshness and capture a stale viewport (both have
 * shipped; see agent-docs/reference/SVG_EXPORT.md).
 *
 * `dataCurrent` is a **thunk**, evaluated only after the terminals are ruled
 * out, for the same MobX reason `computeDisplayPhase`'s `loading` is: freshness
 * typically reads the containing view's `visibleRegions` / `loadedRegions`, and
 * the `when()` in `awaitSvgReady` shouldn't subscribe to that churn while a
 * banner is up.
 */
export function computeSvgReady(
  { error, regionTooLarge, extraTerminal }: SvgReadyTerminals,
  dataCurrent: () => boolean,
) {
  return !!error || regionTooLarge || extraTerminal || dataCurrent()
}

/**
 * Off-screen renderers (SVG export, headless jbrowse-img) must wait until the
 * display reaches a terminal state before reading its data. That whole policy
 * lives in `svgReady`; this is the one shared way to await it, so renderers
 * never re-inline `data != null || error || …`. No time bound: `svgReady` is a
 * terminal state (data loaded, or error / too-large), so it resolves once the
 * fetch it observes settles. If a throwing `svgReady` getter rejects the wait,
 * that error propagates faithfully rather than being masked.
 */
export async function awaitSvgReady(model: Pick<SvgExportable, 'svgReady'>) {
  await when(() => model.svgReady)
}

/**
 * The view-level counterpart, for the wait every `renderToSvg` opens with.
 * `initialized` folds in the view's assemblies, so an assembly that failed to
 * load leaves it false forever — and a bare `when(() => view.initialized)` then
 * hangs the export with the dialog's spinner up and nothing said, the same
 * failure mode on screen the views cure by falling back to their import form.
 * Every view exposes a resolved `error` beside `initialized`; waiting on both
 * and throwing turns that hang into the dialog's error banner.
 *
 * An `error` on an initialized view is not fatal here — the export proceeds and
 * the errored piece renders its own box.
 */
export async function awaitViewInitialized(view: {
  initialized: boolean
  error: unknown
}) {
  await when(() => view.initialized || !!view.error)
  if (!view.initialized) {
    throw new Error(`Cannot export: ${view.error}`, { cause: view.error })
  }
}

/**
 * The display-level counterpart, for a view whose displays all paint one shared
 * surface. A track whose data failed to load has its error caught by the fetch
 * layer and stored on the display, so the export would otherwise write the
 * failure into the figure — and on a shared surface the box saying so is drawn
 * over the tracks that *did* render. An export is a standalone artifact, so a
 * failed track is fatal here: the dialog shows its error banner and saves
 * nothing, and a headless caller (jbrowse-img) exits nonzero instead of writing
 * a broken image.
 *
 * Call it **after** the displays' readiness waits. `awaitSvgReady` resolves *on*
 * the error, so a fetch that fails during the wait is only visible afterwards —
 * reading the errors before the waits reports the ones that had already landed
 * and misses exactly the ones the wait was for.
 *
 * A display that owns its own band keeps the `SvgChrome` box instead: there the
 * box covers only the failed track, which is what the reserved height was for.
 */
export function throwOnExportErrors(errors: unknown[]) {
  const failed = errors.filter(e => e != null)
  if (failed.length > 0) {
    throw new Error(`Cannot export: ${failed.join('\n')}`, { cause: failed[0] })
  }
}
