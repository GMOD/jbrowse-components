import type { CircularViewStateModel } from '../CircularView/model.ts'
import type { CircularViewCommands } from '../CircularView/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractViewContainer } from '@jbrowse/core/util'
import type { SnapshotIn } from '@jbrowse/mobx-state-tree'

// every snapshot property but the ones a launch never writes, plus the launch
// keys: derived from the model, so a new property is authorable
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
  pluginManager.addToExtensionPoint('LaunchView-CircularView', async args => {
    const { session, ...spec } = args
    // `[x].flat()` so an empty `assembly: []` is refused too
    if (![spec.assembly].flat().filter(f => !!f).length) {
      throw new Error(
        'No assembly provided when launching circular genome view',
      )
    }
    await session.launchView('CircularView', spec)
    return args
  })
}
