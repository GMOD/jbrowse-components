import { lazy } from 'react'
import { AbstractSessionModel, isAbstractMenuManager } from '@jbrowse/core/util'
import PluginManager from '@jbrowse/core/PluginManager'
import Plugin from '@jbrowse/core/Plugin'
import ViewComfyIcon from '@material-ui/icons/ViewComfy'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import stateModelFactory from './SpreadsheetView/models/SpreadsheetView'

export default class SpreadsheetViewPlugin extends Plugin {
  name = 'SpreadsheetViewPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(() => {
      return new ViewType({
        name: 'SpreadsheetView',
        stateModel: stateModelFactory(pluginManager),
        ReactComponent: lazy(
          () => import('./SpreadsheetView/components/SpreadsheetView'),
        ),
      })
    })
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToSubMenu(['File', 'Add view'], {
        label: 'Spreadsheet view',
        icon: ViewComfyIcon,
        onClick: (session: AbstractSessionModel) => {
          session.addView('SpreadsheetView', {})
        },
      })
    }
  }
}
