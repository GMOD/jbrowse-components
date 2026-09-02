import type { SvInspectorViewStateModel } from '../SvInspectorView/model.ts'
import type { SvInspectorViewCommands } from '../SvInspectorView/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractViewContainer } from '@jbrowse/core/util'
import type { SnapshotIn } from '@jbrowse/mobx-state-tree'

// The args are a view object — every SvInspectorView snapshot property beside
// the launch keys `SvInspectorViewCommands` declares — minus the ones a launch
// never writes: `type` is fixed, `init`/`launch` are the partition's own blob,
// and the two halves are built from the file the launch keys name. `id` stays,
// so a session spec can pin the created view's id.
//
// Derived rather than listed, like CircularView's and BreakpointSplitView's:
// `onlyDisplayRelevantRegionsInCircularView` and `spreadsheetWidthFraction` were
// declared, settable from the UI, and unreachable from a spec because nobody
// added them to a hand-written list.
export interface LaunchSvInspectorViewArgs
  extends
    Omit<
      SnapshotIn<SvInspectorViewStateModel>,
      | 'type'
      | 'init'
      | 'launch'
      | 'circularView'
      | 'spreadsheetView'
      | keyof SvInspectorViewCommands
    >,
    SvInspectorViewCommands {
  session: AbstractViewContainer
}

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'LaunchView-SvInspectorView': {
      args: LaunchSvInspectorViewArgs
      result: LaunchSvInspectorViewArgs
    }
  }
}

export default function LaunchSvInspectorViewF(pluginManager: PluginManager) {
  /** #extensionPoint LaunchView-SvInspectorView | async | Programmatically launch the SV inspector view */
  pluginManager.addToExtensionPoint(
    'LaunchView-SvInspectorView',
    async args => {
      // Nothing is sorted here — the view's own preProcessSnapshot partitions
      // the launch keys from the properties. With a uri the view imports the
      // file; with only an assembly it lands on the import form with that
      // assembly selected rather than the first one.
      const { session, ...spec } = args
      await session.launchView('SvInspectorView', spec)
      return args
    },
  )
}
