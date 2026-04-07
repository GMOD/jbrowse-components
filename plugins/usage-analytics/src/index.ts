import { ConfigurationSchema, getConf } from '@jbrowse/core/configuration'
import Plugin from '@jbrowse/core/Plugin'
import { addDisposer, addMiddleware } from '@jbrowse/mobx-state-tree'

import ActionTracker from './ActionTracker.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

const configSchema = ConfigurationSchema('UsageAnalyticsPlugin', {
  endpointUrl: {
    type: 'string',
    defaultValue: '',
    description: 'POST endpoint for aggregate usage data. Empty = disabled.',
  },
})

export default class UsageAnalyticsPlugin extends Plugin {
  name = 'UsageAnalyticsPlugin'
  configurationSchema = configSchema

  configure(pluginManager: PluginManager) {
    const rootModel = pluginManager.rootModel
    if (!rootModel) {
      return
    }

    let endpointUrl = ''
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conf = (rootModel as any).jbrowse?.configuration?.UsageAnalyticsPlugin
      if (conf) {
        endpointUrl = getConf(conf, 'endpointUrl') ?? ''
      }
    } catch {
      // config not available in all environments
    }

    const tracker = new ActionTracker(endpointUrl)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = (rootModel as any).session as IAnyStateTreeNode | undefined
    if (!session) {
      return
    }

    const disposeMiddleware = addMiddleware(session, (call, next) => {
      const result = next(call)
      if (!call.parentActionEvent) {
        const detail: {
          viewType?: string
          trackShowType?: string
          trackHideType?: string
          widgetType?: string
        } = {}

        if (call.name === 'addView') {
          const v = call.args?.[0]
          if (typeof v === 'string') detail.viewType = v
        } else if (call.name === 'showTrack' || call.name === 'toggleTrack') {
          const trackId = call.args?.[0]
          if (typeof trackId === 'string') {
            detail.trackShowType = resolveTrackType(trackId, session)
          }
        } else if (call.name === 'hideTrack') {
          const trackId = call.args?.[0]
          if (typeof trackId === 'string') {
            detail.trackHideType = resolveTrackType(trackId, session)
          }
        } else if (call.name === 'addWidget') {
          const w = call.args?.[0]
          if (typeof w === 'string') detail.widgetType = w
        }

        tracker.record(call.name, detail)
      }
      return result
    })

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        tracker.flush('visibility_hidden')
      }
    })

    addDisposer(session, () => {
      disposeMiddleware()
      tracker.dispose()
    })
  }
}

function resolveTrackType(
  trackId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: any,
): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allTracks: any[] = session?.jbrowse?.tracks ?? session?.tracks ?? []
    return allTracks.find(t => t.trackId === trackId)?.type
  } catch {
    return undefined
  }
}
