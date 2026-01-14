import type { LinearSyntenyViewModel } from './LinearSyntenyView/model.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

type LSV = LinearSyntenyViewModel

interface ViewData {
  loc?: string
  assembly: string
  tracks?: string[]
}

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
      views: ViewData[]
      tracks?: string[] | string[][]
    }) => {
      // Flatten tracks array if it's 2D (for backwards compatibility)
      const flatTracks = Array.isArray(tracks[0])
        ? (tracks as string[][]).flat()
        : (tracks as string[])

      // Use the init property to let the model handle initialization
      session.addView('LinearSyntenyView', {
        init: {
          views: views.map(v => ({
            loc: v.loc,
            assembly: v.assembly,
            tracks: v.tracks,
          })),
          tracks: flatTracks,
        },
      }) as LSV
    },
  )
}
