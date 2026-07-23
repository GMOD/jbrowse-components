import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export async function locationLinkClick({
  assemblyName,
  session,
  locString,
  spreadsheetViewId,
}: {
  assemblyName: string
  session: AbstractSessionModel
  locString: string
  spreadsheetViewId: string
}) {
  const newViewId = `${spreadsheetViewId}_${assemblyName}`
  const view = session.views.find(v => v.id === newViewId) as
    | LinearGenomeViewModel
    | undefined
  if (view) {
    // reuse an already-open view by navigating it directly
    await view.navToLocString(locString, assemblyName)
  } else {
    // for a brand-new view launch it declaratively via `init` so it shows a
    // loading spinner (not a flash of the import form) while the assembly
    // loads, then self-navigates
    session.addView('LinearGenomeView', {
      id: newViewId,
      init: { assembly: assemblyName, loc: locString },
    })
  }
}
