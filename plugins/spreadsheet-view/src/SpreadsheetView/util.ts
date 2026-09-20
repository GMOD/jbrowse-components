import type { AbstractViewContainer } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export async function locationLinkClick({
  assemblyName,
  session,
  locString,
  spreadsheetViewId,
  trackIds = [],
}: {
  assemblyName: string
  session: AbstractViewContainer
  locString: string
  spreadsheetViewId: string
  /** the sheet's `drilldownTrackIds`, opened alongside the locus */
  trackIds?: string[]
}) {
  const newViewId = `${spreadsheetViewId}_${assemblyName}`
  const view = session.views.find(v => v.id === newViewId) as
    | LinearGenomeViewModel
    | undefined
  if (view) {
    // reuse an already-open view by navigating it directly. launchTrack is
    // idempotent, so a second row does not stack a second copy — but it does
    // put the track back if the reader closed it, and that is the wrong way
    // round, so only ask when the view has no tracks at all
    if (!view.tracks.length) {
      for (const trackId of trackIds) {
        await view.launchTrack(trackId)
      }
    }
    await view.navToLocString(locString, assemblyName)
  } else {
    // for a brand-new view, write the launch keys on the view object so it
    // shows a loading spinner (not a flash of the import form) while the
    // assembly loads, then self-navigates
    session.addView('LinearGenomeView', {
      id: newViewId,
      assembly: assemblyName,
      loc: locString,
      tracks: trackIds,
    })
  }
}
