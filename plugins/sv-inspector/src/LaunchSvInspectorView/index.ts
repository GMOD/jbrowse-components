import type { SvInspectorViewStateModel } from '../SvInspectorView/model.ts'
import type { SvInspectorViewCommands } from '../SvInspectorView/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractViewContainer } from '@jbrowse/core/util'
import type { SnapshotIn } from '@jbrowse/mobx-state-tree'

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
      const { session, ...spec } = args
      await session.launchView('SvInspectorView', spec)
      return args
    },
  )
}
