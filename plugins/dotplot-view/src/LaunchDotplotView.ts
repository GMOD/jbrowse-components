import type { DotplotViewModel } from './DotplotView/model'
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
      // Use the init property to let the model handle initialization
      session.addView('DotplotView', {
        init: {
          views: views.map(v => ({ assembly: v.assembly })),
          tracks,
        },
      }) as DotplotViewModel
    },
  )
}
