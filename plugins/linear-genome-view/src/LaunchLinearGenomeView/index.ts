import type { TrackInit } from '../LinearGenomeView/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export interface LaunchLinearGenomeViewArgs {
  session: AbstractSessionModel
  assembly?: string
  loc?: string
  tracks?: TrackInit[]
  tracklist?: boolean
  nav?: boolean
  highlight?: string[]
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
  pluginManager.addToExtensionPoint(
    'LaunchView-LinearGenomeView',
    args => {
      const { session, assembly, loc, tracks = [], tracklist, nav, highlight } =
        args
      if (!assembly) {
        throw new Error(
          'No assembly provided when launching linear genome view',
        )
      }
      session.addView('LinearGenomeView', {
        init: {
          assembly,
          loc,
          tracks,
          tracklist,
          nav,
          highlight,
        },
      })
      return args
    },
  )
}
