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
  /** #extensionPoint LaunchView-SpreadsheetView | async | Programmatically launch a spreadsheet view */
  pluginManager.addToExtensionPoint('LaunchView-SpreadsheetView', args => {
    const { session, assembly, uri, fileType } = args
    // only carry an init when there's a file to import; a bare launch should
    // land on the import form rather than auto-importing an empty location
    // (which surfaces a spurious "invalid fileLocation" error)
    session.addView('SpreadsheetView', {
      ...(uri ? { init: { assembly, uri, fileType } } : {}),
    })
    return args
  })
}
