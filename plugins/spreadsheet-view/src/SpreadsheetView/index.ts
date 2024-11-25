import { lazy } from 'react'
import { ViewType } from '@jbrowse/core/pluggableElementTypes'
import stateModel from './models/SpreadsheetView'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function SpreadsheetViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
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
