import { lazy } from 'react'
import { ViewType } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'
import stateModel from './models/SpreadsheetView'

export default (pluginManager: PluginManager) => {
  pluginManager.addViewType(() => {
    return new ViewType({
      ReactComponent: lazy(() => import('./components/SpreadsheetView')),
      displayName: 'Spreadsheet view',
      name: 'SpreadsheetView',
      stateModel,
    })
  })
}

export {
  type SpreadsheetViewModel,
  type SpreadsheetViewStateModel,
} from './models/SpreadsheetView'
