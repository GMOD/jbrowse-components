import type { LinearGenomeViewModel } from '../LinearGenomeView/index.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

type LGV = LinearGenomeViewModel

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
      tracks?: string[]
      tracklist?: boolean
      nav?: boolean
      highlight?: string[]
    }) => {
      if (!assembly) {
        throw new Error(
          'No assembly provided when launching linear genome view',
        )
      }

      // Use the init property to let the model handle initialization
      session.addView('LinearGenomeView', {
        init: {
          assembly,
          loc,
          tracks,
          tracklist,
          nav,
          highlight,
        },
      }) as LGV
    },
  )
}
