import PluginManager from '@jbrowse/core/PluginManager'
import { pluginUrl } from '@jbrowse/core/pluginDefinitions'

import corePlugins from '../corePlugins.ts'
import sessionModelFactory from '../sessionModel/index.ts'
import RootModel from './rootModel.ts'

import type { WebSessionModel } from '../sessionModel/index.ts'
import type Plugin from '@jbrowse/core/Plugin'
import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'

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

  // `jbrowseConfig` supplies every assembly there is: with none passed, the
  // session has an empty assembly list, so a track naming one is exercising
  // the unresolvable case rather than the case the test is named for.
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
