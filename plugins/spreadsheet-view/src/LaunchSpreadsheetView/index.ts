import type { SpreadsheetViewStateModel } from '../SpreadsheetView/SpreadsheetViewModel.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractViewContainer } from '@jbrowse/core/util'
import type { SnapshotIn } from '@jbrowse/mobx-state-tree'

// ABOVE the region marker on purpose: extension_points.md includes the block
// below verbatim as its worked example of declaring an extension point, and
// the reason THIS view omits THESE four keys is not part of that lesson.
//
// The args are every SpreadsheetView snapshot property minus the ones the
// launcher controls itself: `type` is fixed, `init` is the resolution blob the
// handler builds, and the sheet and its import wizard are built from that blob.
// `id` stays, so a session spec can pin the created view's id. Derived rather
// than listed, like the other launchers' — `height` and
// `hideVerticalResizeHandle` were declared and unreachable from a spec because
// a hand-written list never grew to mention them.
// #region registry
export interface LaunchSpreadsheetViewArgs extends Omit<
  SnapshotIn<SpreadsheetViewStateModel>,
  'type' | 'init' | 'spreadsheet' | 'importWizard'
> {
  session: AbstractViewContainer
  // the assembly the sheet's rows are read against. With only this and no
  // `uri`, the view opens on its import form with that assembly already
  // selected rather than the first one in the config
  assembly: string
  // the file to load into the sheet. A spec view is untyped user input, so this
  // can be absent, and the view then opens on the import form
  uri?: string
  // the file's format. Otherwise detected from the extension, falling back to
  // VCF, so name it for a file the extension does not identify
  fileType?: string
  // search-box text, applied once the file is loaded
  filterText?: string
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
    const { session, assembly, uri, fileType, filterText, ...viewProps } = args
    // carry an init whenever the caller named anything to apply. With a uri it
    // imports the file; with only an assembly it still lands on the import
    // form, but with that assembly selected rather than the first one. An
    // empty init is skipped so no one feeds an empty location to openLocation
    // (which surfaces a spurious "invalid fileLocation" error)
    session.addView('SpreadsheetView', {
      ...viewProps,
      ...(assembly || uri
        ? { init: { assembly, uri, fileType, filterText } }
        : {}),
    })
    return args
  })
}
