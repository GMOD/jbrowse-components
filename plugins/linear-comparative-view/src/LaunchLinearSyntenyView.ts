import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export default function LaunchLinearSyntenyView(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'LaunchView-LinearSyntenyView',
    // @ts-expect-error
    async ({
      session,
      views,
      tracks = [],
    }: {
      session: AbstractSessionModel
      views: { loc?: string; assembly: string; tracks?: string[] }[]
      tracks?: string[] | string[][]
    }) => {
      session.addView('LinearSyntenyView', {
        init: { views, tracks },
      })
    },
  )
}
