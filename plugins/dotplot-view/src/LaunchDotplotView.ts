import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export interface LaunchDotplotViewArgs {
  session: AbstractSessionModel
  views: { assembly: string }[]
  tracks?: string[]
}

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'LaunchView-DotplotView': {
      args: LaunchDotplotViewArgs
      result: LaunchDotplotViewArgs
    }
  }
}

export default function LaunchDotplotView(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint('LaunchView-DotplotView', args => {
    const { session, views, tracks = [] } = args
    if (views.length < 2) {
      throw new Error('DotplotView requires 2 views to be specified')
    }
    session.addView('DotplotView', {
      init: {
        views,
        tracks,
      },
    })
    return args
  })
}
