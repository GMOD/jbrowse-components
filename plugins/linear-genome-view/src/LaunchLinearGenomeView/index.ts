import type {
  InitState,
  LinearGenomeViewLaunchProps,
} from '../LinearGenomeView/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractViewContainer } from '@jbrowse/core/util'

// Launch args are a view object: every setting written directly on it, the keys
// that need resolving beside the plain view props. Nothing is sorted here — the
// view's own `preProcessSnapshot` partitions the snapshot, which is what makes a
// spec, a `defaultSession` view and an `addView` literal one shape. `assembly`
// is relaxed to optional since it is validated at runtime below. An optional
// `id` lets a session spec pin the created view's id so another view (e.g. a
// connected MsaView) can reference it via connectedViewId.
export type LaunchLinearGenomeViewArgs = Partial<InitState> &
  LinearGenomeViewLaunchProps & {
    session: AbstractViewContainer
    id?: string
  }

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'LaunchView-LinearGenomeView': {
      args: LaunchLinearGenomeViewArgs
      result: LaunchLinearGenomeViewArgs
    }
  }
}

export default function LaunchLinearGenomeViewF(pluginManager: PluginManager) {
  /** #extensionPoint LaunchView-LinearGenomeView | async | Programmatically launch a linear genome view */
  pluginManager.addToExtensionPoint('LaunchView-LinearGenomeView', args => {
    const { session, ...spec } = args
    if (!spec.assembly) {
      throw new Error('No assembly provided when launching linear genome view')
    }
    session.addView('LinearGenomeView', spec)
    return args
  })
}
