import { lazy } from 'react'
import { ViewType } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'
import stateModel, {
  SpreadsheetViewModel,
  SpreadsheetViewStateModel,
} from './models/SpreadsheetView'

export default (pluginManager: PluginManager) => {
  pluginManager.addViewType(() => {
    return new ViewType({
      name: 'SpreadsheetView',
      displayName: 'Spreadsheet view',
      stateModel,
      ReactComponent: lazy(() => import('./components/SpreadsheetView')),
    })
  })
}

export type { SpreadsheetViewStateModel, SpreadsheetViewModel }
