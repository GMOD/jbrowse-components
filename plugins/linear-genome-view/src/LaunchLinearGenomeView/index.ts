import {
  linearGenomeViewPropKeys,
  partitionLaunchKeys,
  warnUnknownLaunchKeys,
} from '../LinearGenomeView/initKeys.ts'

import type {
  InitState,
  LinearGenomeViewLaunchProps,
} from '../LinearGenomeView/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractViewContainer } from '@jbrowse/core/util'

// Launch args are flat, like every other LaunchView-<type>'s: the resolution
// keys and the plain view props side by side, sorted out below. (A snapshot —
// config/defaultSession — nests the resolution keys under `init` instead, because
// there they are MST state rather than arguments; loadSessionSpec reports a spec
// that confuses the two.) `assembly` is relaxed to optional since it is validated
// at runtime below. An optional `id` lets a session spec pin the created view's id
// so another view (e.g. a connected MsaView) can reference it via connectedViewId.
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
    const { session, id, ...spec } = args
    if (!spec.assembly) {
      throw new Error('No assembly provided when launching linear genome view')
    }
    // Resolution keys go into the one-shot `init` blob afterAttach applies and
    // discards; plain props go straight onto the view snapshot, where MST
    // restores them natively (and, except for the purely localStorage-backed
    // showCenterLine, persist on save). Anything in neither set is a typo — MST
    // drops unknown snapshot keys and `init` is a frozen blob, so nothing
    // downstream would notice.
    const { init, viewProps, unknown } = partitionLaunchKeys(
      spec,
      linearGenomeViewPropKeys(pluginManager),
    )
    warnUnknownLaunchKeys('LaunchView-LinearGenomeView', unknown)
    // A provided id is passed top-level so MST's optional identifier honors it
    // (undefined falls back to an auto-generated id).
    session.addView('LinearGenomeView', { id, ...viewProps, init })
    return args
  })
}
