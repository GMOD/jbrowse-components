import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export interface LaunchCircularViewArgs {
  session: AbstractSessionModel
  assembly?: string
  tracks?: string[]
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
  pluginManager.addToExtensionPoint(
    'LaunchView-CircularView',
    args => {
      const { session, assembly, tracks = [] } = args
      if (!assembly) {
        throw new Error(
          'No assembly provided when launching circular genome view',
        )
      }
      session.addView('CircularView', {
        init: {
          assembly,
          tracks,
        },
      })
      return args
    },
  )
}
