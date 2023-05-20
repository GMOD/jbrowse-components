import PluginManager from '@jbrowse/core/PluginManager'
import corePlugins from '../corePlugins'
import RootModel from './rootModel'
import sessionModelFactory, { WebSessionModel } from '../sessionModel'

export function createTestSession(snapshot = {}, adminMode = false) {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()

  const root = RootModel({
    pluginManager,
    sessionModelFactory,
    adminMode,
  }).create(
    {
      jbrowse: {
        configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
      },
      assemblyManager: {},
    },
    { pluginManager },
  )
  root.setSession({
    name: 'testSession',
    ...snapshot,
  })

  const session = root.session as WebSessionModel
  session.views.map(view => view.setWidth(800))
  pluginManager.setRootModel(root)
  pluginManager.configure()
  return session
}
