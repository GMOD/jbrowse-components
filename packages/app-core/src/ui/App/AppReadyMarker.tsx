import { observer } from 'mobx-react'

import type { AppSession } from './types.ts'
import type {
  AbstractTrackModel,
  AbstractViewModel,
} from '@jbrowse/core/util/types'

/**
 * The per-view flags and per-display phase the marker reads beyond the census
 * contract. Duck-typed because they are view- and display-family specifics
 * (`showLoading` is the LGV's), not part of AbstractViewModel — absent means
 * not loading, the same rule the phase attributes follow.
 */
interface ViewFlags {
  showLoading?: boolean
  initialized?: boolean
}
interface DisplayLike {
  displayPhase?: string
}

function trackLoading(track: AbstractTrackModel) {
  return track.displays.some(d => (d as DisplayLike).displayPhase === 'loading')
}

function viewLoading(view: AbstractViewModel) {
  const flags = view as ViewFlags
  return flags.showLoading === true || flags.initialized === false
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
 * walk itself is the views' own `allViews`/`ownTracks` contract (BaseViewModel
 * derives it), so this component knows nothing about which property a
 * container view keeps its children on either.
 *
 * Its own component, and `hidden`, for two reasons: an observer here subscribes
 * to every view's phase without re-rendering the app shell around it, and a
 * marker that is never drawn cannot be mistaken for UI or shift a layout. It is
 * still found by `querySelector`, which is what reads it.
 *
 * **What it is silent about**: a display in a TERMINAL state. `error` is a
 * finished state, so this reads `ready` over a display whose fetch failed —
 * correctly, since nothing is still working. A capture wants more than that: it
 * wants a picture, and an error banner is not one. `waitForDisplaysDone` after
 * this is what draws that line, keying on the `data-display-drawn` the two
 * comparative canvases publish from their stricter `settled` gate (see
 * `comparativeReadiness` in `@jbrowse/synteny-core`, which holds both answers
 * and says why an error separates them). Both harnesses do it in that order.
 */
const AppReadyMarker = observer(function AppReadyMarker({
  session,
}: {
  session: AppSession
}) {
  const views = session.views.flatMap(v => v.allViews)
  const tracks = views.flatMap(v => v.ownTracks)
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
