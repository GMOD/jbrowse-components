import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export interface LaunchBreakpointSplitViewArgs {
  session: AbstractSessionModel
  views: {
    loc?: string
    assembly: string
    tracks?: string[]
  }[]
}

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'LaunchView-BreakpointSplitView': {
      args: LaunchBreakpointSplitViewArgs
      result: LaunchBreakpointSplitViewArgs
    }
  }
}

export default function LaunchBreakpointSplitViewF(
  pluginManager: PluginManager,
) {
  pluginManager.addToExtensionPoint(
    'LaunchView-BreakpointSplitView',
    args => {
      const { session, views } = args
      if (views.length < 2) {
        throw new Error(
          'BreakpointSplitView requires at least 2 views to be specified',
        )
      }
      session.addView('BreakpointSplitView', {
        init: {
          views,
        },
      })
      return args
    },
  )
}
