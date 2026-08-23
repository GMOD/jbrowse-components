import type { SvInspectorViewStateModel } from '../SvInspectorView/model.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractViewContainer } from '@jbrowse/core/util'
import type { SnapshotIn } from '@jbrowse/mobx-state-tree'

// Every SvInspectorView snapshot property minus the ones the launcher controls
// itself: `type` is fixed, `init` is the resolution blob built below, and the
// two halves are built from that blob rather than authored here. `id` stays, so
// a session spec can pin the created view's id.
//
// Derived rather than listed, like CircularView's and BreakpointSplitView's:
// `onlyDisplayRelevantRegionsInCircularView` and `spreadsheetWidthFraction` were
// declared, settable from the UI, and unreachable from a spec because nobody
// added them to a hand-written list.
export interface LaunchSvInspectorViewArgs extends Omit<
  SnapshotIn<SvInspectorViewStateModel>,
  'type' | 'init' | 'circularView' | 'spreadsheetView'
> {
  session: AbstractViewContainer
  // the assembly both halves are read against. With only this and no `uri`, the
  // view opens on its import form with that assembly already selected rather
  // than the first one in the config
  assembly: string
  // the file to load. A spec view is untyped user input, so this can be absent,
  // and the view then opens on the import form
  uri?: string
  // the file's format. Otherwise detected from the extension, falling back to
  // VCF, so name it for a file the extension does not identify
  fileType?: string
  // search-box text for the spreadsheet half, applied once the file is loaded.
  // The circular half draws the rows it leaves, so this is what makes a chord
  // subset reachable from a link
  filterText?: string
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
    const { session, assembly, uri, fileType, filterText, ...viewProps } = args
    // carry an init whenever the caller named anything to apply. With a uri it
    // imports the file; with only an assembly it still lands on the import
    // form, but with that assembly selected rather than the first one. An
    // empty init is skipped so no one feeds an empty location to openLocation
    // (which surfaces a spurious "invalid fileLocation" error)
    session.addView('SvInspectorView', {
      ...viewProps,
      ...(assembly || uri
        ? { init: { assembly, uri, fileType, filterText } }
        : {}),
    })
    return args
  })
}
