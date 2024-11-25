import PluginManager from '@jbrowse/core/PluginManager'
import corePlugins from '../corePlugins'
import RootModel from './rootModel'
import sessionModelFactory from '../sessionModel'
import type { WebSessionModel } from '../sessionModel'

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
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()

  const root = RootModel({
    pluginManager,
    sessionModelFactory,
    adminMode,
  }).create(
    {
      jbrowse: {
        configuration: {
          rpc: { defaultDriver: 'MainThreadRpcDriver' },
          // @ts-expect-error
          ...jbrowseConfig.configuration,
        },
        ...jbrowseConfig,
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
