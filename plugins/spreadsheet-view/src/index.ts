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
          session.addView('SpreadsheetView', {})
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
export type { SpreadsheetViewInit } from './SpreadsheetView/SpreadsheetViewModel.ts'
export type {
  GridRow,
  RowSet,
  SpreadsheetSnapshot,
} from './SpreadsheetView/SpreadsheetModel.tsx'

// Re-exported so the `declare module '@jbrowse/core/PluginManager'` block in
// this module reaches an installed consumer. tsc keeps a module in the emitted
// `.d.ts` only when the entry's public surface names it; a value import used
// inside `install()` is erased, and so was this point's declaration — leaving
// `addToExtensionPoint` on its untyped overload for the external plugin the
// point exists for. `scripts/check-extension-point-reachability.ts` is the gate.
export type { LaunchSpreadsheetViewArgs } from './LaunchSpreadsheetView/index.ts'
