import type { BreakpointViewModel } from '../BreakpointSplitView/model'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export default function LaunchBreakpointSplitViewF(
  pluginManager: PluginManager,
) {
  pluginManager.addToExtensionPoint(
    'LaunchView-BreakpointSplitView',
    // @ts-expect-error
    async ({
      session,
      views,
    }: {
      session: AbstractSessionModel
      views: {
        loc?: string
        assembly: string
        tracks?: string[]
      }[]
    }) => {
      if (views.length < 2) {
        throw new Error(
          'BreakpointSplitView requires at least 2 views to be specified',
        )
      }

      session.addView('BreakpointSplitView', {
        init: {
          views,
        },
      }) as BreakpointViewModel
    },
  )
}
