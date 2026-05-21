import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export default function LaunchDotplotView(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'LaunchView-DotplotView',
    // @ts-expect-error
    async ({
      session,
      views,
      tracks = [],
    }: {
      session: AbstractSessionModel
      views: { assembly: string }[]
      tracks?: string[]
    }) => {
      if (views.length < 2) {
        throw new Error('DotplotView requires 2 views to be specified')
      }
      session.addView('DotplotView', {
        init: {
          views,
          tracks,
        },
      })
    },
  )
}
