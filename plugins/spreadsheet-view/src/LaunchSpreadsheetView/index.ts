import type { SpreadsheetViewStateModel } from '../SpreadsheetView/SpreadsheetViewModel.ts'
import type { SpreadsheetViewCommands } from '../SpreadsheetView/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractViewContainer } from '@jbrowse/core/util'
import type { SnapshotIn } from '@jbrowse/mobx-state-tree'

// ABOVE the region marker on purpose: extension_points.md includes the block
// below verbatim as its worked example of declaring an extension point, and
// the reason THIS view omits THESE keys is not part of that lesson.
//
// The args are a view object — every SpreadsheetView snapshot property beside
// the launch keys `SpreadsheetViewCommands` declares — minus the ones a launch
// never writes: `type` is fixed, `init`/`launch` are the partition's own blob,
// and the sheet and its import wizard are built from the file the launch keys
// name. `id` stays, so a session spec can pin the created view's id. Derived
// rather than listed, like the other launchers' — `height` and
// `hideVerticalResizeHandle` were declared and unreachable from a spec because
// a hand-written list never grew to mention them.
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
      // Nothing is sorted here — the view's own preProcessSnapshot partitions
      // the launch keys from the properties, which is what makes a spec, a
      // `defaultSession` view and an `addView` literal one shape. With a uri
      // the view imports the file; with only an assembly it lands on the
      // import form with that assembly selected rather than the first one.
      const { session, ...spec } = args
      await session.launchView('SpreadsheetView', spec)
      return args
    },
  )
}
