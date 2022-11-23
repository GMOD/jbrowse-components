import PluginManager from '@jbrowse/core/PluginManager'
import Plugin from '@jbrowse/core/Plugin'
import { AbstractSessionModel, isAbstractMenuManager } from '@jbrowse/core/util'

// icons
import ViewComfyIcon from '@mui/icons-material/ViewComfy'

// locals
import SpreadsheetViewF, {
  SpreadsheetViewModel,
  SpreadsheetViewStateModel,
} from './SpreadsheetView'

import LaunchSpreadsheetViewF from './LaunchSpreadsheetView'

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

export type { SpreadsheetViewStateModel, SpreadsheetViewModel }
