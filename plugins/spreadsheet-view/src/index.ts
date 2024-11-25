import Plugin from '@jbrowse/core/Plugin'
import { isAbstractMenuManager } from '@jbrowse/core/util'

// icons
import ViewComfyIcon from '@mui/icons-material/ViewComfy'

// locals
import LaunchSpreadsheetViewF from './LaunchSpreadsheetView'
import SpreadsheetViewF from './SpreadsheetView'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export default class SpreadsheetViewPlugin extends Plugin {
  name = 'SpreadsheetViewPlugin'

  install(pluginManager: PluginManager) {
    SpreadsheetViewF(pluginManager)
    LaunchSpreadsheetViewF(pluginManager)
  }

  configure(pluginManager: PluginManager) {
    const { rootModel } = pluginManager
    if (isAbstractMenuManager(rootModel)) {
      rootModel.appendToSubMenu(['Add'], {
        label: 'Spreadsheet view',
        icon: ViewComfyIcon,
        onClick: (session: AbstractSessionModel) => {
          session.addView('SpreadsheetView', {})
        },
      })
    }
  }
}

export {
  type SpreadsheetViewModel,
  type SpreadsheetViewStateModel,
} from './SpreadsheetView'
