import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

function isNestedTracks(t: string[] | string[][]): t is string[][] {
  return Array.isArray(t[0])
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
      views: { loc?: string; assembly: string; tracks?: string[] }[]
      tracks?: string[] | string[][]
    }) => {
      if (views.length < 2) {
        throw new Error(
          'LinearSyntenyView requires at least 2 views to be specified',
        )
      }
      // Normalize 1D tracks to 2D — flat array goes to level 0. The 2D form
      // targets one entry per level (between views[i] and views[i+1]).
      session.addView('LinearSyntenyView', {
        init: {
          views,
          tracks: isNestedTracks(tracks) ? tracks : [tracks],
        },
      })
    },
  )
}
