import PluginManager from '@jbrowse/core/PluginManager'
import corePlugins from '../corePlugins'
import RootModel from './rootModel'
import sessionModelFactory, { WebSessionModel } from '../sessionModel'

export function createTestSession(args?: {
  adminMode?: boolean
  sessionSnapshot?: Record<string, unknown>
  configuration?: Record<string, unknown>
}) {
  const {
    sessionSnapshot = {},
    adminMode = false,
    configuration = {},
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
          ...configuration?.configuration,
        },
        ...configuration,
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
