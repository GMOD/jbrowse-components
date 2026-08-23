import type { CircularViewStateModel } from '../CircularView/model.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractViewContainer } from '@jbrowse/core/util'
import type { TrackInit } from '@jbrowse/core/util/tracks'
import type { SnapshotIn } from '@jbrowse/mobx-state-tree'

// Every CircularView snapshot property (autoFit, paddingPx, spacingPx,
// minimumRadiusPx, hideTrackSelectorButton, ...) minus the ones the launcher
// controls itself: `type` is fixed, `init` is the resolution blob built below,
// and `tracks`/`displayedRegions` are replaced by the declarative
// `tracks`/`displayedRegionNames` here (resolved async against the assembly).
// `id` stays, so a session spec can pin the created view's id.
//
// DERIVED, not restated. Only `height` used to be listed, so the other eight
// were unreachable from a session spec, a share link or a config
// defaultSession — declared, menu-settable, and silently dropped from every
// authored surface. Same failure LinearSyntenyView's `drawLocationMarkers` had,
// and the same fix BreakpointSplitView's launcher already uses: take the shape
// from the model, and a property is authorable — and type-checked — from the
// line that declares it.
type CircularViewSnapshot = SnapshotIn<CircularViewStateModel>

export interface LaunchCircularViewArgs extends Omit<
  CircularViewSnapshot,
  'type' | 'init' | 'tracks' | 'displayedRegions'
> {
  session: AbstractViewContainer
  // the assembly whose chromosomes the circle draws. Optional because a spec
  // view is untyped user input; without one the view opens on its import form
  assembly?: string
  // whole chromosomes to draw, in this order; the rest of the assembly's
  // contigs are left off the circle
  displayedRegionNames?: string[]
  tracks?: TrackInit[]
}

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'LaunchView-CircularView': {
      args: LaunchCircularViewArgs
      result: LaunchCircularViewArgs
    }
  }
}

export default function LaunchCircularViewF(pluginManager: PluginManager) {
  /** #extensionPoint LaunchView-CircularView | async | Programmatically launch a circular view */
  pluginManager.addToExtensionPoint('LaunchView-CircularView', args => {
    const {
      session,
      assembly,
      displayedRegionNames,
      tracks = [],
      ...viewProps
    } = args
    if (!assembly) {
      throw new Error(
        'No assembly provided when launching circular genome view',
      )
    }
    // Whatever is left after the four keys above is a plain view property, and
    // goes on the snapshot: MST restores it natively, validates it, and it
    // round-trips on save. `id` rides along the same way, which is what makes
    // MST's optional identifier honor it rather than generating one.
    session.addView('CircularView', {
      ...viewProps,
      init: {
        assembly,
        displayedRegionNames,
        tracks,
      },
    })
    return args
  })
}
