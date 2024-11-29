import type PluginManager from '@jbrowse/core/PluginManager'

export interface ViewSpec {
  type: string
  tracks?: string[]
  assembly: string
  loc: string
}

// use extension point named e.g. LaunchView-LinearGenomeView to initialize an
// LGV session
export function loadSessionSpec(
  {
    views,
    sessionTracks = [],
  }: {
    views: ViewSpec[]
    sessionTracks: unknown[]
  },
  pluginManager: PluginManager,
) {
  return async () => {
    const { rootModel } = pluginManager
    if (!rootModel) {
      throw new Error('rootModel not initialized')
    }
    try {
      // @ts-expect-error
      rootModel.setSession({
        name: `New session ${new Date().toLocaleString()}`,
      })

      // @ts-expect-error
      sessionTracks.forEach(track => rootModel.session.addTrackConf(track))

      await Promise.all(
        views.map(view =>
          pluginManager.evaluateAsyncExtensionPoint(`LaunchView-${view.type}`, {
            ...view,
            session: rootModel.session,
          }),
        ),
      )
    } catch (e) {
      console.error(e)
      rootModel.session?.notify(`${e}`)
    }
  }
}
