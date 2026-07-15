import { pluginUrl } from '@jbrowse/core/PluginLoader'
import PluginManager from '@jbrowse/core/PluginManager'

import corePlugins from '../corePlugins.ts'
import RootModel from './rootModel.ts'
import sessionModelFactory from '../sessionModel/index.ts'

import type { WebSessionModel } from '../sessionModel/index.ts'
import type Plugin from '@jbrowse/core/Plugin'
import type { PluginDefinition } from '@jbrowse/core/PluginLoader'

export function createTestSession(args?: {
  adminMode?: boolean
  sessionSnapshot?: Record<string, unknown>
  jbrowseConfig?: {
    configuration?: Record<string, unknown>
    [key: string]: unknown
  }
  // pre-loaded runtime plugins, mirroring how createPluginManager builds
  // metadata so installed-plugin/session-plugin UI flows can be exercised
  runtimePlugins?: { plugin: Plugin; definition: PluginDefinition }[]
}): WebSessionModel {
  const {
    sessionSnapshot = {},
    adminMode = false,
    jbrowseConfig = {},
    runtimePlugins = [],
  } = args ?? {}
  const pluginManager = new PluginManager([
    ...corePlugins.map(P => new P()),
    ...runtimePlugins.map(({ plugin, definition }) => ({
      plugin,
      definition,
      metadata: { url: pluginUrl(definition) },
    })),
  ]).createPluggableElements()

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
