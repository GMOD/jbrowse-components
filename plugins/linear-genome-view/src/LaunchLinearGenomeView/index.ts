import type { TrackInit } from '../LinearGenomeView/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export default function LaunchLinearGenomeViewF(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'LaunchView-LinearGenomeView',
    // @ts-expect-error
    async ({
      session,
      assembly,
      loc,
      tracks = [],
      tracklist,
      nav,
      highlight,
    }: {
      session: AbstractSessionModel
      assembly?: string
      loc?: string
      tracks?: TrackInit[]
      tracklist?: boolean
      nav?: boolean
      highlight?: string[]
    }) => {
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
    },
  )
}
