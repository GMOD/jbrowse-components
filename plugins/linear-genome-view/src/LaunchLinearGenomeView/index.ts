import type { InitState } from '../LinearGenomeView/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

// the launch args are the declarative InitState (with assembly relaxed to
// optional, since it's validated at runtime below) plus the target session.
// An optional `id` lets a session spec pin the created view's id so another
// view (e.g. a connected MsaView) can reference it via connectedViewId.
export type LaunchLinearGenomeViewArgs = Partial<InitState> & {
  session: AbstractSessionModel
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
    // args is the InitState plus the target session and an optional id;
    // everything except session/id forwards verbatim into the view's
    // declarative init. assembly is pulled out so the throw narrows it to a
    // required string (InitState requires it). A provided id is passed
    // top-level so MST's optional identifier honors it (undefined falls back to
    // an auto-generated id).
    const { session, id, assembly, ...rest } = args
    if (!assembly) {
      throw new Error('No assembly provided when launching linear genome view')
    }
    session.addView('LinearGenomeView', {
      id,
      init: { ...rest, assembly },
    })
    return args
  })
}
