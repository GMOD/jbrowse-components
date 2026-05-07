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
      // Normalize 1D tracks to 2D — flat array goes to level 0. The 2D form
      // targets one entry per level (between views[i] and views[i+1]).
      const tracks2D: string[][] = Array.isArray(tracks[0])
        ? (tracks as string[][])
        : [tracks as string[]]

      session.addView('LinearSyntenyView', {
        init: {
          views: views.map(v => ({
            loc: v.loc,
            assembly: v.assembly,
            tracks: v.tracks,
          })),
          tracks: tracks2D,
        },
      })
    },
  )
}
