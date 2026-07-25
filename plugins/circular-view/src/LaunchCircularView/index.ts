import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export interface LaunchCircularViewArgs {
  session: AbstractSessionModel
  assembly?: string
  tracks?: string[]
  // optional explicit view id, so another view in the same session spec can
  // reference this one
  id?: string
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
    const { session, id, assembly, tracks = [] } = args
    if (!assembly) {
      throw new Error(
        'No assembly provided when launching circular genome view',
      )
    }
    // a provided id is passed top-level so MST's optional identifier honors it
    // (undefined falls back to an auto-generated id)
    session.addView('CircularView', {
      id,
      init: {
        assembly,
        tracks,
      },
    })
    return args
  })
}
