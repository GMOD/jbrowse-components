import { lazy } from 'react'
import { AbstractSessionModel, isAbstractMenuManager } from '@jbrowse/core/util'
import PluginManager from '@jbrowse/core/PluginManager'
import Plugin from '@jbrowse/core/Plugin'
import ViewComfyIcon from '@mui/icons-material/ViewComfy'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import SpreadsheetViewModel from './SpreadsheetView/models/SpreadsheetView'

export default class SpreadsheetViewPlugin extends Plugin {
  name = 'SpreadsheetViewPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(() => {
      return new ViewType({
        name: 'SpreadsheetView',
        stateModel: SpreadsheetViewModel,
        ReactComponent: lazy(
          () => import('./SpreadsheetView/components/SpreadsheetView'),
        ),
      })
    })
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToSubMenu(['Add'], {
        label: 'Spreadsheet view',
        icon: ViewComfyIcon,
        onClick: (session: AbstractSessionModel) => {
          session.addView('SpreadsheetView', {})
        },
      })
    }
  }
}
