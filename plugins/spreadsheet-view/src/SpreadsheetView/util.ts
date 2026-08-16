import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export async function locationLinkClick({
  assemblyName,
  session,
  locString,
  spreadsheetViewId,
  trackId,
}: {
  assemblyName: string
  session: AbstractSessionModel
  locString: string
  spreadsheetViewId: string
  /**
   * the session track for the file the sheet was loaded from, opened alongside
   * the locus. Without it the view arrives at the right place showing none of
   * the records that sent it there
   */
  trackId?: string
}) {
  const newViewId = `${spreadsheetViewId}_${assemblyName}`
  const view = session.views.find(v => v.id === newViewId) as
    | LinearGenomeViewModel
    | undefined
  if (view) {
    // reuse an already-open view by navigating it directly. showTrack is
    // idempotent, so a second row does not stack a second copy — but it does
    // put the track back if the reader closed it, and that is the wrong way
    // round, so only ask when the view has no tracks at all
    if (trackId && !view.tracks.length) {
      view.showTrack(trackId)
    }
    await view.navToLocString(locString, assemblyName)
  } else {
    // for a brand-new view launch it declaratively via `init` so it shows a
    // loading spinner (not a flash of the import form) while the assembly
    // loads, then self-navigates
    session.addView('LinearGenomeView', {
      id: newViewId,
      init: {
        assembly: assemblyName,
        loc: locString,
        ...(trackId ? { tracks: [trackId] } : {}),
      },
    })
  }
}
