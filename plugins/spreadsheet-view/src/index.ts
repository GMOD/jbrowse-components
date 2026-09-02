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
    // configure also runs in the web worker, which has no rootModel — the
    // guard is what keeps a menu contribution from throwing there
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
export { spreadsheetLaunchKeys } from './SpreadsheetView/launchKeys.ts'
export type { SpreadsheetViewCommands } from './SpreadsheetView/types.ts'
export type {
  GridRow,
  RowSet,
  SpreadsheetSnapshot,
} from './SpreadsheetView/SpreadsheetModel.tsx'

// Carries this module's extension-point declaration into the emitted `.d.ts`;
// `scripts/check-extension-point-reachability.ts` is the gate, and its header
// is the why.
export type { LaunchSpreadsheetViewArgs } from './LaunchSpreadsheetView/index.ts'
