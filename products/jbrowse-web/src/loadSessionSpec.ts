import type { ViewSpec } from './types'
import type PluginManager from '@jbrowse/core/PluginManager'

// use extension point named e.g. LaunchView-LinearGenomeView to initialize an
// LGV session
export async function loadSessionSpec(
  {
    views,
    sessionTracks = [],
  }: {
    views: ViewSpec[]
    sessionTracks?: Record<string, unknown>[]
  },
  pluginManager: PluginManager,
) {
  const rootModel = pluginManager.rootModel!

  try {
    // @ts-expect-error
    rootModel.setSession({
      name: `New session ${new Date().toLocaleString()}`,
    })

    for (const track of sessionTracks) {
      // @ts-expect-error
      rootModel.session.addTrackConf(track)
    }

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
    rootModel.session?.notifyError(`${e}`, e)
  }
}
