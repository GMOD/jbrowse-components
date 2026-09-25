import { observer } from 'mobx-react'

import { openTracks, openViews } from '../util/openViews.ts'

import type {
  AbstractSessionModel,
  AbstractTrackModel,
  AbstractViewModel,
} from '../util/types/index.ts'

/**
 * The per-view flags and per-display phase the marker reads beyond the census
 * contract. Duck-typed because they are view- and display-family specifics
 * (`showLoading` is the LGV's), not part of AbstractViewModel — absent means
 * not loading, the same rule the phase attributes follow.
 *
 * `showLoading` is also the one hook a view type outside this tree has into
 * readiness: a plugin view that fetches something no display publishes a
 * phase for (protein3d's structure load into Molstar) publishes it as this
 * getter, and `jb.waitReady`, the capture tools and this marker all wait on it
 * without knowing the view. Before it, an agent driving that view waited on
 * guessed timers.
 */
interface ViewFlags {
  showLoading?: boolean
  initialized?: boolean
  error?: unknown
  pendingLaunch?: unknown
  showImportForm?: boolean
}
interface DisplayLike {
  displayPhase?: string
}

function trackLoading(track: AbstractTrackModel) {
  return track.displays.some(d => (d as DisplayLike).displayPhase === 'loading')
}

/**
 * A view whose init failed (its assembly was never found) stays uninitialized
 * for good and paints its error, so like a display's terminal phase it is
 * finished, not pending: without this the whole app read `loading` for as long
 * as that view was open, and every settle answered false with no reason.
 *
 * `pendingLaunch` is the third term and the one that was missing. `initialized`
 * goes true mid-launch — LGV's flips the moment displayedRegions land, while
 * the same apply pass still has the spec's tracks to attach — and `showLoading`
 * goes false at the same moment, deliberately, so the reader sees the
 * navigated view rather than a spinner while its tracks arrive. That left a
 * window, exactly as wide as attaching the tracks, in which the marker said
 * `ready` over a session missing everything it had been asked for.
 * `whenViewSettled` states the same rule for the callers that await a single
 * view, and says why in more detail. Not shared as one predicate: that one
 * requires `initialized`, while absent here means not loading, and an adapter
 * between the two null rules would read as agreement it does not have.
 *
 * `showImportForm` excuses the `initialized` term, and only that one. The
 * comparative views spell `initialized` as "every row exists and is ready" —
 * LinearSyntenyView's wants `views.length > 0`, dotplot's wants regions on both
 * axes — so a view clicked into existence through `Add -> Linear synteny view`
 * reads uninitialized for as long as its form is up, which is until a person
 * fills it in. The app sat at `loading` behind every import-form figure. The
 * other two terms keep their meaning: `showLoading` is the spinner the form
 * yields to, and `showImportForm` is already false while a launch is pending.
 */
function viewLoading(view: AbstractViewModel) {
  const flags = view as ViewFlags
  return (
    flags.error === undefined &&
    (flags.showLoading === true ||
      flags.pendingLaunch !== undefined ||
      (flags.initialized === false && flags.showImportForm !== true))
  )
}

/**
 * One element that says whether the whole app has finished, and what is open.
 *
 * `[data-app-phase="ready"]` is the entire readiness contract for anything
 * driving JBrowse from outside — a screenshot tool, a test, an agent. Wait for
 * that selector and you are done; there is no chain to assemble and no
 * per-display census to take.
 *
 * Why it exists when `data-view-phase` and `data-display-phase` already do:
 * those are per-element and NEGATIVE. Asking them "is everything finished"
 * means asserting that no element carries the loading value, which is equally
 * true of an app that has not started — and the gap is real, measured at about
 * a second on a two-track session. A positive attribute cannot be satisfied
 * early, because something has to render it.
 *
 * The census attributes beside it — `data-app-views`, `data-app-assemblies`,
 * `data-app-tracks` (the latter two JSON arrays) — publish WHAT is open the
 * same way the phase publishes whether it is done, so an outside reader asking
 * "is the track I requested actually open" reads one element instead of
 * walking `window.JBrowseSession` with its own copy of the view nesting. The
 * walk itself is `openViews`/`openTracks` over each view's declared
 * `ownViews`/`ownTracks`, so this component knows nothing about which property
 * a container view keeps its children on either.
 *
 * Its own component, and `hidden`, for two reasons: an observer here subscribes
 * to every view's phase without re-rendering the app shell around it, and a
 * marker that is never drawn cannot be mistaken for UI or shift a layout. It is
 * still found by `querySelector`, which is what reads it.
 *
 * **What it is silent about**: a display in a TERMINAL state. `error` and
 * `canceled` are finished states, so this reads `ready` over a display whose
 * fetch failed or that the user stopped — correctly, since nothing is still
 * working, and a user's cancel is durable until Retry. A capture wants more than
 * that: it wants a picture, and neither banner is one. The capture census after
 * this is what draws that line: `waitForDisplaysDone` keys on the
 * `data-display-drawn` the two comparative canvases publish from their stricter
 * `settled` gate (see `comparativeReadiness` in `@jbrowse/synteny-core`, which
 * holds both answers and says why an error separates them), and the census
 * names every `data-display-phase="canceled"`.
 */
const AppReadyMarker = observer(function AppReadyMarker({
  session,
}: {
  session: AbstractSessionModel
}) {
  const views = openViews(session)
  const tracks = openTracks(session)
  const loading = views.some(viewLoading) || tracks.some(trackLoading)
  return (
    <span
      hidden
      data-testid="app-ready-marker"
      data-app-phase={loading ? 'loading' : 'ready'}
      data-app-views={session.views.length}
      data-app-assemblies={JSON.stringify([
        ...new Set(views.flatMap(v => v.assemblyNames ?? [])),
      ])}
      data-app-tracks={JSON.stringify(
        tracks.map(
          t => (t.configuration as { trackId?: string }).trackId ?? '(unnamed)',
        ),
      )}
    />
  )
})

export default AppReadyMarker
