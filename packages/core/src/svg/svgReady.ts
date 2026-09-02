import { when } from 'mobx'

import { whenViewSettled } from '../util/whenViewSettled.ts'

// Elapsed, not idle. An idle bound would be the better instrument — a slow
// export progresses, a stuck one does not — but there is no signal to hang it
// on: `svgReady` is a computed that stays false for the whole fetch, so mobx
// never re-evaluates the predicate to say work is still landing, and only one
// of the five display families exposes `isLoading`.
//
// So the number carries the whole argument, and it is picked to make a false
// failure implausible rather than merely unlikely: half an hour, against real
// exports over remote 1000 Genomes data that finish in about ten seconds and a
// worst measured case in low minutes. A caller that knows it is slower than
// that passes its own bound; nothing here fails an export that is merely slow.
const SVG_READY_TIMEOUT_MS = 1_800_000

/**
 * The contract every GPU display's `renderSvg` relies on: a `svgReady` gate
 * (the per-display terminal-state getter — see MultiRegionDisplayMixin /
 * GlobalFetchMixin) and the `error` it fails the export on.
 * Duck-typed `renderSvg` model interfaces extend this so the compiler catches a
 * missing field instead of it surfacing as a runtime hang or a silent blank.
 */
export interface SvgExportable {
  svgReady: boolean
  error: unknown
  // the too-large terminal state; `SvgChrome` renders it as a message box so an
  // over-budget region exports a labeled note instead of a silent blank.
  regionTooLarge: boolean
  // a standing user cancel ("Loading canceled / Retry" on screen). Optional
  // because a display with no cancel affordance (chord) has no such state;
  // where it exists, `awaitSvgReady` fails the export on it the way it fails
  // on `error` — the canceled data is not coming, so waiting would hang and
  // proceeding would export a blank
  fetchCanceled?: boolean
}

/**
 * The terminal states that let an export proceed with no current data. Mirrors
 * `DisplayPhaseInputs`: named fields, all required, so adding a state is a
 * compile error at every call site rather than a silently missing branch.
 *
 * `extraTerminal` is the display-specific escape hatch — sequence sets it when
 * zoomed past base resolution, where it renders a static "zoom in" message and
 * fetches nothing, so a data-only gate would never resolve.
 *
 * `fetchCanceled` is the user's own resting state: a standing cancel holds the
 * fetch gate shut until Retry or a viewport change, and an export causes
 * neither, so without this terminal `awaitSvgReady` waits out its whole bound
 * with the dialog up and nothing said, then fails. A display family with no
 * cancel affordance answers it `false`.
 */
export interface SvgReadyTerminals {
  error: unknown
  regionTooLarge: boolean
  extraTerminal: boolean
  fetchCanceled: boolean
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
  { error, regionTooLarge, extraTerminal, fetchCanceled }: SvgReadyTerminals,
  dataCurrent: () => boolean,
) {
  return (
    !!error || regionTooLarge || extraTerminal || fetchCanceled || dataCurrent()
  )
}

/**
 * Off-screen renderers (SVG export, headless jbrowse-img) must wait until the
 * display reaches a terminal state before reading its data. That whole policy
 * lives in `svgReady`; this is the one shared way to await it, so renderers
 * never re-inline `data != null || error || …`. No time bound: `svgReady` is a
 * terminal state (data loaded, or error / too-large), so it resolves once the
 * fetch it observes settles. If a throwing `svgReady` getter rejects the wait,
 * that error propagates faithfully rather than being masked.
 *
 * It then fails the export if the terminal it settled on was the error
 * (`throwOnExportErrors`, below, for why that is fatal), making this the exact
 * display-level twin of `awaitViewInitialized`: both wait for `settled || error`
 * and both refuse to continue on the error, so the postcondition of each is
 * "there is something to draw". Folded in rather than left to the caller because
 * `svgReady` is *true* on error, so a caller that awaits and stops there gets a
 * display with nothing to draw and no sign of why.
 *
 * Every display uses this one, including the ones with nowhere to draw an error
 * (dotplot, synteny) — a display never has to know whether it owns the surface
 * it paints, because the thing that made that distinction matter, reporting all
 * the failures rather than one, is `awaitSvgRenders`'s job.
 *
 * A standing user cancel fails the export the same way an error does, and for
 * the same reason the error is folded in rather than left to the caller: the
 * cancel terminal makes `svgReady` *true* over a display with nothing to draw,
 * so a caller that awaits and stops there exports that track blank in silence.
 * On screen the same state shows "Loading canceled / Retry", so the loud
 * failure matches what the user is looking at.
 */
export async function awaitSvgReady(
  model: Pick<SvgExportable, 'svgReady' | 'error' | 'fetchCanceled'>,
  timeoutMs = SVG_READY_TIMEOUT_MS,
) {
  // Only the bound is rewritten. A `svgReady` getter that throws rejects here
  // too, and that error is the caller's answer, not a timeout.
  await when(() => model.svgReady, { timeout: timeoutMs }).catch(
    (e: unknown) => {
      throw e instanceof Error && e.message === 'WHEN_TIMEOUT'
        ? new Error(
            `a display never became ready to export, after ${Math.round(timeoutMs / 60_000)} minutes. ` +
              'Every wait here ends on data, an error or a cancel, so this is ' +
              'none of the three: a gate that cannot converge. Pass a longer ' +
              'timeoutMs if this export really does take longer than that.',
          )
        : e
    },
  )
  throwOnExportErrors([
    model.error == null && model.fetchCanceled
      ? new Error('data loading was canceled — Retry the track, then export')
      : model.error,
  ])
}

/**
 * The view-level counterpart, for the wait every `renderToSvg` opens with:
 * `whenViewSettled` in the export's own vocabulary. Why the bare
 * `when(() => view.initialized)` it replaced could not fail — only hang — is
 * documented there.
 *
 * Only a view that never initialized is fatal *here*. A track error on an
 * initialized view is fatal too, but it is the displays' readiness waits that
 * report it (`throwOnExportErrors`), after this one has let the export start.
 */
export async function awaitViewInitialized(view: {
  initialized: boolean
  error: unknown
  pendingLaunch?: unknown
}) {
  if (!(await whenViewSettled(view))) {
    // the wait only resolves on one of the two, so `error` is set here — and
    // routing it through the shared thrower keeps one wording for "the export
    // failed", whichever half of the export noticed
    throwOnExportErrors([view.error])
  }
}

/**
 * How the export answers "a track failed": by failing. A track whose data won't
 * load has its error caught by the fetch layer and stored on the display, so the
 * render itself still returns — with that track blank.
 *
 * An export is a standalone artifact, so a failed track is fatal: the dialog
 * shows its error banner and saves nothing, and a headless caller (jbrowse-img)
 * exits nonzero instead of writing a broken image. Drawing the error into the
 * figure instead costs more than the red rect it leaves in the picture: on a
 * shared surface (dotplot plot rect, synteny band) the box covers the tracks
 * that *did* render, and a snapshot regenerated while a display is broken
 * absorbs the stack trace as expected output — which is how a real crash sat
 * inside two committed goldens without turning anything red.
 *
 * `regionTooLarge` is deliberately not routed here — see `SvgChrome`.
 *
 * The failures are kept on the thrown error so that nesting one `awaitSvgRenders`
 * inside another (synteny: rows of tracks *and* levels of ribbons) still reports
 * every leaf rather than one per group.
 */
export function throwOnExportErrors(errors: unknown[]) {
  const failed = errors.filter(e => e != null)
  if (failed.length > 0) {
    throw Object.assign(
      new Error(`Cannot export: ${failed.join('\n')}`, { cause: failed[0] }),
      { exportFailures: failed },
    )
  }
}

/**
 * The individual failures behind one rejection: the list `throwOnExportErrors`
 * attached, or the rejection itself for anything else (a body that threw, which
 * is a failure the same way a 404 is).
 */
function leafFailures(error: unknown): unknown[] {
  return error !== null &&
    typeof error === 'object' &&
    'exportFailures' in error &&
    Array.isArray(error.exportFailures)
    ? error.exportFailures
    : [error]
}

async function settledOrThrow(renders: readonly unknown[]) {
  const settled = await Promise.allSettled(renders)
  throwOnExportErrors(
    settled.flatMap(r =>
      r.status === 'rejected' ? leafFailures(r.reason) : [],
    ),
  )
  return settled.flatMap(r => (r.status === 'fulfilled' ? [r.value] : []))
}

/**
 * `Promise.all` for the renders a view fans out, differing in the one way an
 * export needs: it fails with **every** failure instead of whichever rejected
 * first. Exporting a session with three broken tracks should not mean finding
 * the second one by fixing the first and exporting again. Nest it freely — an
 * inner fan-out's failures are flattened into the outer one's report.
 *
 * That is also what lets every display await through the plain `awaitSvgReady`.
 * A display on a shared surface (the dotplot's plot rect, a synteny level's
 * band) has nowhere to draw an error and nothing complete to say alone; the
 * alternative is for it to stay silent and let its view read the combined error
 * back *after* the waits, which nothing enforces and every new shared-surface
 * view has to rediscover. Here the display just throws, and being complete is
 * the fan-out's job rather than the display's.
 */
export async function awaitSvgRenders<T extends readonly unknown[] | []>(
  renders: T,
): Promise<{ -readonly [K in keyof T]: Awaited<T[K]> }> {
  // the mapped-tuple return type `Promise.all` also declares, and also can't
  // produce from a value-level `map`. Past the throw inside, every entry is
  // fulfilled, so the array really is that tuple.
  return (await settledOrThrow(renders)) as {
    -readonly [K in keyof T]: Awaited<T[K]>
  }
}
