import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

// #region registry
export interface LaunchSpreadsheetViewArgs {
  session: AbstractSessionModel
  assembly: string
  // a spec view is untyped user input, so both of these can be absent: without
  // a uri the view opens on the import form
  uri?: string
  fileType?: string
  // optional explicit view id, so another view in the same session spec can
  // reference this one
  id?: string
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
  pluginManager.addToExtensionPoint('LaunchView-SpreadsheetView', args => {
    const { session, id, assembly, uri, fileType } = args
    // carry an init whenever the caller named anything to apply. With a uri it
    // imports the file; with only an assembly it still lands on the import
    // form, but with that assembly selected rather than the first one. An
    // empty init is skipped so no one feeds an empty location to openLocation
    // (which surfaces a spurious "invalid fileLocation" error)
    session.addView('SpreadsheetView', {
      id,
      ...(assembly || uri ? { init: { assembly, uri, fileType } } : {}),
    })
    return args
  })
}
