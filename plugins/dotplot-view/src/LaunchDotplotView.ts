import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { SyntenyViewSharedInit } from '@jbrowse/synteny-core'

export interface LaunchDotplotViewArgs extends SyntenyViewSharedInit {
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
    const { session, views, tracks = [], ...rest } = args
    if (views.length < 2) {
      throw new Error('DotplotView requires 2 views to be specified')
    }
    session.addView('DotplotView', {
      init: {
        views,
        tracks,
        ...(rest.autoDiagonalize !== undefined && {
          autoDiagonalize: rest.autoDiagonalize,
        }),
        ...(rest.colorBy !== undefined && { colorBy: rest.colorBy }),
        ...(rest.minAlignmentLength !== undefined && {
          minAlignmentLength: rest.minAlignmentLength,
        }),
      },
    })
    return args
  })
}
