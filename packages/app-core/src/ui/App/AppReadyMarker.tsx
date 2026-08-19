import { observer } from 'mobx-react'

import type { AppSession } from './types.ts'

/** A view whose displays we can ask, without importing any view's model type. */
interface DisplayLike {
  displayPhase?: string
}
interface TrackLike {
  displays?: DisplayLike[]
}
/** a view's own track list, or one of the several it owns instead. */
interface TrackContainerLike {
  tracks?: TrackLike[]
}
interface ViewLike extends TrackContainerLike {
  showLoading?: boolean
  initialized?: boolean
  trackContainers?: TrackContainerLike[]
  views?: ViewLike[]
}

function containerLoading(container: TrackContainerLike): boolean {
  return (container.tracks ?? []).some(track =>
    (track.displays ?? []).some(d => d.displayPhase === 'loading'),
  )
}

/**
 * Is anything in this session still working?
 *
 * The same two facts the per-element attributes publish — a view still
 * resolving its assembly, a display still in its own fetch — reduced to one
 * answer for the whole app. Duck-typed rather than imported: every view type
 * would otherwise have to be a dependency of the app shell.
 */
function anythingLoading(views: ViewLike[]): boolean {
  return views.some(
    view =>
      view.showLoading === true ||
      view.initialized === false ||
      containerLoading(view) ||
      // A view whose tracks hang off something else — the synteny view's are on
      // its levels, one list per band. `view.tracks` is empty there, so without
      // this a stack of ribbons still fetching reads as idle.
      (view.trackContainers ?? []).some(containerLoading) ||
      anythingLoading(view.views ?? []),
  )
}

/**
 * One element that says whether the whole app has finished.
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
  return (
    <span
      hidden
      data-testid="app-ready-marker"
      data-app-phase={
        anythingLoading(session.views as ViewLike[]) ? 'loading' : 'ready'
      }
    />
  )
})

export default AppReadyMarker
