import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export interface LaunchSvInspectorViewArgs {
  session: AbstractSessionModel
  assembly: string
  // a spec view is untyped user input, so both of these can be absent: without
  // a uri the view opens on the import form
  uri?: string
  fileType?: string
  // search-box text for the spreadsheet half, applied once the file is loaded.
  // The circular half draws the rows it leaves, so this is what makes a chord
  // subset reachable from a link
  filterText?: string
  height?: number
  // optional explicit view id, so another view in the same session spec can
  // reference this one
  id?: string
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
    const { session, id, assembly, uri, fileType, filterText, height } = args
    // carry an init whenever the caller named anything to apply. With a uri it
    // imports the file; with only an assembly it still lands on the import
    // form, but with that assembly selected rather than the first one. An
    // empty init is skipped so no one feeds an empty location to openLocation
    // (which surfaces a spurious "invalid fileLocation" error)
    session.addView('SvInspectorView', {
      id,
      ...(height ? { height } : {}),
      ...(assembly || uri
        ? { init: { assembly, uri, fileType, filterText } }
        : {}),
    })
    return args
  })
}
