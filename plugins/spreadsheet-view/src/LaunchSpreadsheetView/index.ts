import type { SpreadsheetViewStateModel } from '../SpreadsheetView/SpreadsheetViewModel.ts'
import type { SpreadsheetViewCommands } from '../SpreadsheetView/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractViewContainer } from '@jbrowse/core/util'
import type { SnapshotIn } from '@jbrowse/mobx-state-tree'

// Outside the region extension_points.md quotes. The args are a view object,
// minus what a launch never writes: the fixed `type`, the launch blob, and the
// sheet and wizard the file builds. `id` stays, so a spec can pin it.
// #region registry
export interface LaunchSpreadsheetViewArgs
  extends
    Omit<
      SnapshotIn<SpreadsheetViewStateModel>,
      | 'type'
      | 'init'
      | 'launch'
      | 'spreadsheet'
      | 'importWizard'
      | keyof SpreadsheetViewCommands
    >,
    SpreadsheetViewCommands {
  session: AbstractViewContainer
}

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'LaunchView-SpreadsheetView': {
      args: LaunchSpreadsheetViewArgs
      result: LaunchSpreadsheetViewArgs
    }
  }
}
// #endregion

export default function LaunchSpreadsheetViewF(pluginManager: PluginManager) {
  /** #extensionPoint LaunchView-SpreadsheetView | async | Programmatically launch a spreadsheet view */
  pluginManager.addToExtensionPoint(
    'LaunchView-SpreadsheetView',
    async args => {
      // the view's own preProcessSnapshot sorts launch keys from properties
      const { session, ...spec } = args
      await session.launchView('SpreadsheetView', spec)
      return args
    },
  )
}
