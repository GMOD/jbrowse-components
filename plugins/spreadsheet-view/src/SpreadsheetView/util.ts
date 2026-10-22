import type {
  AbstractViewContainer,
  NotificationSink,
} from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

async function openLocus({
  assemblyName,
  session,
  locString,
  spreadsheetViewId,
  trackIds,
}: {
  assemblyName: string
  session: AbstractViewContainer
  locString: string
  spreadsheetViewId: string
  trackIds: string[]
}) {
  const newViewId = `${spreadsheetViewId}_${assemblyName}`
  const view = session.views.find(v => v.id === newViewId) as
    | LinearGenomeViewModel
    | undefined
  if (view) {
    // launchTrack would also put back a track the reader closed, so only seed
    // the tracks into a view that has none
    if (!view.tracks.length) {
      for (const trackId of trackIds) {
        await view.launchTrack(trackId)
      }
    }
    await view.navToLocString(locString, assemblyName)
  } else {
    // launch keys on the view object, so it shows a spinner rather than a
    // flash of the import form while the assembly loads
    session.addView('LinearGenomeView', {
      id: newViewId,
      assembly: assemblyName,
      loc: locString,
      tracks: trackIds,
    })
  }
}

/**
 * Open a row's locus in the sheet's linear view, reusing the one an earlier
 * row opened. A failure goes to the session's notifications.
 */
export async function locationLinkClick({
  session,
  trackIds = [],
  ...rest
}: {
  assemblyName: string
  session: AbstractViewContainer & NotificationSink
  locString: string
  spreadsheetViewId: string
  /** the sheet's `drilldownTrackIds`, opened alongside the locus */
  trackIds?: string[]
}) {
  try {
    await openLocus({ session, trackIds, ...rest })
  } catch (e) {
    console.error(e)
    session.notifyError(`${e}`, e)
  }
}
