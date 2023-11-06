import { getSession } from '@jbrowse/core/util'
import { getParent } from 'mobx-state-tree'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel
type MaybeLGV = LinearGenomeViewModel | undefined

// locals
import { SpreadsheetModel } from '../models/Spreadsheet'

export function locationLinkClick(
  spreadsheet: SpreadsheetModel,
  locString: string,
) {
  const session = getSession(spreadsheet)
  const { assemblyName } = spreadsheet
  const { id } = getParent<{ id: string }>(spreadsheet)

  const newViewId = `${id}_${assemblyName}`
  let view = session.views.find(v => v.id === newViewId) as MaybeLGV
  if (!view) {
    view = session.addView('LinearGenomeView', { id: newViewId }) as LGV
  }
  return view.navToLocString(locString, assemblyName)
}
