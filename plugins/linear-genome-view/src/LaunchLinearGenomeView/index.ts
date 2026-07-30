import { splitLaunchSpec } from '../LinearGenomeView/initKeys.ts'

import type {
  InitState,
  LinearGenomeViewLaunchProps,
} from '../LinearGenomeView/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

// the launch args are the declarative InitState (with assembly relaxed to
// optional, since it's validated at runtime below) plus plain persisted view
// props and the target session. An optional `id` lets a session spec pin the
// created view's id so another view (e.g. a connected MsaView) can reference it
// via connectedViewId.
export type LaunchLinearGenomeViewArgs = Partial<InitState> &
  LinearGenomeViewLaunchProps & {
    session: AbstractSessionModel
    id?: string
    // the session-spec form is the flattened `init` (the URL params, as
    // documented in urlparams.md), but config/defaultSession views nest the same
    // keys under `init`, so a spec author moving a view between the two surfaces
    // writes this. Merged rather than rejected — a flat sibling wins.
    init?: Partial<InitState>
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
    const { session, id, init: nested, ...flat } = args
    const spec = { ...nested, ...flat }
    if (!spec.assembly) {
      throw new Error('No assembly provided when launching linear genome view')
    }
    const { init, viewProps, unknown } = splitLaunchSpec(spec)
    if (unknown.length) {
      console.warn(
        `LaunchView-LinearGenomeView ignored unknown key(s): ${unknown.join(', ')}`,
      )
    }
    // A provided id is passed top-level so MST's optional identifier honors it
    // (undefined falls back to an auto-generated id).
    session.addView('LinearGenomeView', { id, ...viewProps, init })
    return args
  })
}
