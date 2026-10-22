import Plugin from '@jbrowse/core/Plugin'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import ViewComfyIcon from '@mui/icons-material/ViewComfy'

import LaunchSpreadsheetViewF from './LaunchSpreadsheetView/index.ts'
import SpreadsheetViewF from './SpreadsheetView/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractViewContainer } from '@jbrowse/core/util'

// #region plugin
export default class SpreadsheetViewPlugin extends Plugin {
  name = 'SpreadsheetViewPlugin'

  install(pluginManager: PluginManager) {
    SpreadsheetViewF(pluginManager)
    LaunchSpreadsheetViewF(pluginManager)
  }

  configure(pluginManager: PluginManager) {
    const { rootModel } = pluginManager
    // configure also runs in the worker, which has no rootModel
    if (isAbstractMenuManager(rootModel)) {
      rootModel.appendToMenu('Add', {
        label: 'Spreadsheet view',
        icon: ViewComfyIcon,
        onClick: (session: AbstractViewContainer) => {
          void session.launchView('SpreadsheetView', {})
        },
      })
    }
  }
}
// #endregion

export {
  type SpreadsheetViewModel,
  type SpreadsheetViewStateModel,
} from './SpreadsheetView/index.ts'
export type { SpreadsheetViewCommands } from './SpreadsheetView/types.ts'
export type {
  GridRow,
  RowSet,
  SpreadsheetSnapshot,
} from './SpreadsheetView/SpreadsheetModel.tsx'

// keeps the extension-point declaration in the emitted .d.ts
export type { LaunchSpreadsheetViewArgs } from './LaunchSpreadsheetView/index.ts'
