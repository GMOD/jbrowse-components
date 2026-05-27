import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export interface LaunchSvInspectorViewArgs {
  session: AbstractSessionModel
  assembly: string
  uri: string
  fileType?: string
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
  pluginManager.addToExtensionPoint(
    'LaunchView-SvInspectorView',
    args => {
      const { session, assembly, uri, fileType } = args
      session.addView('SvInspectorView', {
        init: {
          assembly,
          uri,
          fileType,
        },
      })
      return args
    },
  )
}
