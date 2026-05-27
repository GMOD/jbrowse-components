import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export interface LaunchSpreadsheetViewArgs {
  session: AbstractSessionModel
  assembly: string
  uri: string
  fileType?: string
}

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'LaunchView-SpreadsheetView': {
      args: LaunchSpreadsheetViewArgs
      result: LaunchSpreadsheetViewArgs
    }
  }
}

export default function LaunchSpreadsheetViewF(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint('LaunchView-SpreadsheetView', args => {
    const { session, assembly, uri, fileType } = args
    session.addView('SpreadsheetView', {
      init: {
        assembly,
        uri,
        fileType,
      },
    })
    return args
  })
}
