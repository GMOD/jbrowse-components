import { observer } from 'mobx-react'

import type { AppSession } from './types.ts'

/** A view whose displays we can ask, without importing any view's model type. */
interface DisplayLike {
  displayPhase?: string
}
interface TrackLike {
  displays?: DisplayLike[]
}
interface ViewLike {
  showLoading?: boolean
  initialized?: boolean
  tracks?: TrackLike[]
  views?: ViewLike[]
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
      (view.tracks ?? []).some(track =>
        (track.displays ?? []).some(d => d.displayPhase === 'loading'),
      ) ||
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
 * **What it is silent about**: a display that publishes no `displayPhase`. The
 * two comparative views are the ones that do not — a dotplot and a synteny level
 * report paint-complete through their own `settled` getter, which reaches the DOM
 * as `data-display-drawn` and by no other route — so on those pages this reads
 * `ready` over a canvas that is finished FETCHING and still blank. A capture
 * there wants `waitForDisplaysDone` after this, which is what both harnesses do;
 * `agent-docs/TODO.md` carries the other half, which is to give those two a
 * phase.
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
