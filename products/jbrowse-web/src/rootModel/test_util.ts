import PluginManager from '@jbrowse/core/PluginManager'

import corePlugins from '../corePlugins.ts'
import RootModel from './rootModel.ts'
import sessionModelFactory from '../sessionModel/index.ts'

import type { WebSessionModel } from '../sessionModel/index.ts'

export function createTestSession(args?: {
  adminMode?: boolean
  sessionSnapshot?: Record<string, unknown>
  jbrowseConfig?: Record<string, unknown>
}): WebSessionModel {
  const {
    sessionSnapshot = {},
    adminMode = false,
    jbrowseConfig = {},
  } = args || {}
  const pluginManager = new PluginManager(
    corePlugins.map(P => new P()),
  ).createPluggableElements()

  const root = RootModel({
    pluginManager,
    sessionModelFactory,
    adminMode,
  }).create(
    {
      jbrowse: {
        ...jbrowseConfig,
        configuration: {
          rpc: {
            defaultDriver: 'MainThreadRpcDriver',
          },
          // @ts-expect-error
          ...jbrowseConfig.configuration,
        },
      },
    },
    { pluginManager },
  )
  root.setSession({
    name: 'testSession',
    ...sessionSnapshot,
  })

  const session = root.session as WebSessionModel
  session.views.map(view => view.setWidth(800))
  pluginManager.setRootModel(root)
  pluginManager.configure()
  return session
}
