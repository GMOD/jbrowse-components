import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export default function LaunchCircularViewF(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'LaunchView-CircularView',
    // @ts-expect-error
    async ({
      session,
      assembly,
      tracks = [],
    }: {
      session: AbstractSessionModel
      assembly?: string
      tracks?: string[]
    }) => {
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
    },
  )
}
