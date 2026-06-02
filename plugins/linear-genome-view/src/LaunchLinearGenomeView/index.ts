import type { InitState } from '../LinearGenomeView/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

// the launch args are the declarative InitState (with assembly relaxed to
// optional, since it's validated at runtime below) plus the target session
export type LaunchLinearGenomeViewArgs = Partial<InitState> & {
  session: AbstractSessionModel
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
  pluginManager.addToExtensionPoint('LaunchView-LinearGenomeView', args => {
    // args is the InitState plus the target session, so everything except
    // session forwards verbatim into the view's declarative init
    const { session, ...init } = args
    if (!init.assembly) {
      throw new Error('No assembly provided when launching linear genome view')
    }
    session.addView('LinearGenomeView', {
      init: { ...init, assembly: init.assembly },
    })
    return args
  })
}
