import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export interface LaunchSvInspectorViewArgs {
  session: AbstractSessionModel
  assembly: string
  uri: string
  fileType?: string
  height?: number
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
  pluginManager.addToExtensionPoint('LaunchView-SvInspectorView', args => {
    const { session, assembly, uri, fileType, height } = args
    // only carry an init when there's a file to import; a bare launch should
    // land on the import form rather than auto-importing an empty location
    // (which surfaces a spurious "invalid fileLocation" error)
    session.addView('SvInspectorView', {
      ...(height ? { height } : {}),
      ...(uri ? { init: { assembly, uri, fileType } } : {}),
    })
    return args
  })
}
