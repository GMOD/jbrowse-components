import PluginManager, { corePluginRecords } from '@jbrowse/core/PluginManager'
import { pluginUrl } from '@jbrowse/core/pluginDefinitions'

import corePlugins from '../corePlugins.ts'
import sessionModelFactory from '../sessionModel/index.ts'
import RootModel from './rootModel.ts'

import type { WebSessionModel } from '../sessionModel/index.ts'
import type Plugin from '@jbrowse/core/Plugin'
import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'

interface CreateTestSessionArgs {
  adminMode?: boolean
  sessionSnapshot?: Record<string, unknown>
  jbrowseConfig?: {
    configuration?: Record<string, unknown>
    [key: string]: unknown
  }
  // pre-loaded runtime plugins, mirroring how createPluginManager builds
  // metadata so installed-plugin/session-plugin UI flows can be exercised
  runtimePlugins?: { plugin: Plugin; definition: PluginDefinition }[]
}

function buildTestRoot(args?: CreateTestSessionArgs) {
  const {
    sessionSnapshot = {},
    adminMode = false,
    jbrowseConfig = {},
    runtimePlugins = [],
  } = args ?? {}
  const pluginManager = new PluginManager([
    ...corePluginRecords(corePlugins),
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
  return {
    pluginManager,
    root,
    snapshot: {
      name: 'testSession',
      ...sessionSnapshot,
    },
  }
}

function finishTestSession({
  pluginManager,
  root,
  snapshot,
}: ReturnType<typeof buildTestRoot>) {
  root.setSession(snapshot)

  const session = root.session as WebSessionModel
  session.views.map(view => view.setWidth(800))
  pluginManager.setRootModel(root)
  pluginManager.configure()
  return session
}

export function createTestSession(args?: CreateTestSessionArgs) {
  return finishTestSession(buildTestRoot(args))
}

/**
 * `createTestSession` for a session snapshot that names a view type whose state
 * model is registered lazily — `setSession` is synchronous and throws on one
 * that has not been loaded, so the load has to happen first.
 */
export async function createTestSessionAsync(args?: CreateTestSessionArgs) {
  const built = buildTestRoot(args)
  await built.pluginManager.preloadSessionTypes(built.snapshot)
  return finishTestSession(built)
}
