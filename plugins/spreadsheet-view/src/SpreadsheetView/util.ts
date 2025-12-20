import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function locationLinkClick({
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
  let view = session.views.find(v => v.id === newViewId) as
    | LinearGenomeViewModel
    | undefined
  if (!view) {
    view = session.addView('LinearGenomeView', {
      id: newViewId,
    }) as LinearGenomeViewModel
  }
  return view.navToLocString(locString, assemblyName)
}
