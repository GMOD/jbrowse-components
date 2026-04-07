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
        tracker.record(call.name)
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
