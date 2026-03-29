import { JBrowseModelF } from '@jbrowse/app-core'
import PluginManager from '@jbrowse/core/PluginManager'
import assemblyConfigSchemaFactory from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import { BaseRootModelFactory } from '@jbrowse/product-core'
import { BaseWebSession } from '@jbrowse/web-core'

import type { PluginConstructor } from '@jbrowse/core/Plugin'

export function createTestSession(
  plugins: PluginConstructor[],
  args?: {
    adminMode?: boolean
    sessionSnapshot?: Record<string, unknown>
    jbrowseConfig?: Record<string, unknown>
  },
) {
  const {
    sessionSnapshot = {},
    adminMode = false,
    jbrowseConfig = {},
  } = args || {}
  const pluginManager = new PluginManager(
    plugins.map(P => new P()),
  ).createPluggableElements()

  const assemblyConfigSchema = assemblyConfigSchemaFactory(pluginManager)
  const jbrowseModelType = JBrowseModelF({
    pluginManager,
    assemblyConfigSchema,
    adminMode,
  })
  const sessionModelType = BaseWebSession({
    pluginManager,
    assemblyConfigSchema,
  })
  const root = BaseRootModelFactory({
    pluginManager,
    jbrowseModelType,
    sessionModelType,
    assemblyConfigSchema,
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

  const session = root.session!
  session.views.map(view => view.setWidth(800))
  pluginManager.setRootModel(root)
  pluginManager.configure()
  return session
}
