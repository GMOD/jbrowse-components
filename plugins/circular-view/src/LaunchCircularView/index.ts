import type { CircularViewStateModel } from '../CircularView/model.ts'
import type { CircularViewCommands } from '../CircularView/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractViewContainer } from '@jbrowse/core/util'
import type { SnapshotIn } from '@jbrowse/mobx-state-tree'

// Every CircularView snapshot property (autoFit, paddingPx, spacingPx,
// minimumRadiusPx, hideTrackSelectorButton, ...) minus the ones a launch never
// writes: `type` is fixed, `init`/`launch` are the partition's own blob, and
// `displayedRegions` is what `displayedRegionNames` resolves into. The launch
// keys come from `CircularViewCommands`, so the args are a view object — the
// same shape a `defaultSession` view and a session spec take. `id` stays, so a
// session spec can pin the created view's id.
//
// DERIVED, not restated. Only `height` used to be listed, so the other eight
// were unreachable from a session spec, a share link or a config
// defaultSession — declared, menu-settable, and silently dropped from every
// authored surface. Same failure LinearSyntenyView's `drawLocationMarkers` had,
// and the same fix BreakpointSplitView's launcher already uses: take the shape
// from the model, and a property is authorable — and type-checked — from the
// line that declares it.
type CircularViewSnapshot = SnapshotIn<CircularViewStateModel>

export interface LaunchCircularViewArgs
  extends
    Omit<
      CircularViewSnapshot,
      | 'type'
      | 'init'
      | 'launch'
      | 'displayedRegions'
      | 'tracks'
      | 'assembly'
      | 'displayedRegionNames'
    >,
    CircularViewCommands {
  session: AbstractViewContainer
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
    const { session, ...spec } = args
    if (!spec.assembly) {
      throw new Error(
        'No assembly provided when launching circular genome view',
      )
    }
    // Nothing is sorted here — the view's own `preProcessSnapshot` partitions
    // the snapshot, which is what makes a spec, a `defaultSession` view and an
    // `addView` literal one shape. `id` rides along the same way, which is what
    // makes MST's optional identifier honor it rather than generating one.
    session.addView('CircularView', spec)
    return args
  })
}
