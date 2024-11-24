import { lazy } from 'react'
import { ViewType } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'
// locals
import stateModelFactory from './models/SpreadsheetView'

export default function SpreadsheetViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    const stateModel = stateModelFactory()
    return new ViewType({
      name: 'SpreadsheetView',
      displayName: 'Spreadsheet view',
      stateModel,
      ReactComponent: lazy(() => import('./components/SpreadsheetView')),
    })
  })
}

export {
  type SpreadsheetViewModel,
  type SpreadsheetViewStateModel,
} from './models/SpreadsheetView'
