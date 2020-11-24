import { AbstractSessionModel, isAbstractMenuManager } from '@jbrowse/core/util'
import PluginManager from '@jbrowse/core/PluginManager'
import Plugin from '@jbrowse/core/Plugin'
import ViewComfyIcon from '@material-ui/icons/ViewComfy'
import SpreadsheetViewTypeFactory from './SpreadsheetView/SpreadsheetViewType'

export default class SpreadsheetViewPlugin extends Plugin {
  name = 'SpreadsheetViewPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(SpreadsheetViewTypeFactory),
    )
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToSubMenu(['File', 'Add'], {
        label: 'Spreadsheet view',
        icon: ViewComfyIcon,
        onClick: (session: AbstractSessionModel) => {
          session.addView('SpreadsheetView', {})
        },
      })
    }
  }
}
