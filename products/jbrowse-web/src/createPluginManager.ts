import PluginManager from '@jbrowse/core/PluginManager'
import { doAnalytics } from '@jbrowse/core/util/analytics'

// locals
import { loadSessionSpec } from './SessionLoader'
import corePlugins from './corePlugins'
import JBrowseRootModelFactory from './rootModel/rootModel'
import sessionModelFactory from './sessionModel'
import type { SessionLoaderModel } from './SessionLoader'

export function createPluginManager(self: SessionLoaderModel) {
  // it is ready when a session has loaded and when there is no config
  // error Assuming that the query changes self.sessionError or
  // self.sessionSnapshot or self.blankSession
  const pluginManager = new PluginManager([
    ...corePlugins.map(P => ({
      plugin: new P(),
      metadata: { isCore: true },
    })),
    ...self.runtimePlugins.map(({ plugin: P, definition }) => ({
      plugin: new P(),
      definition,
      metadata: {
        // @ts-expect-error
        url: definition.url,
      },
    })),
    ...self.sessionPlugins.map(({ plugin: P, definition }) => ({
      plugin: new P(),
      definition,
      metadata: {
        // @ts-expect-error
        url: definition.url,
      },
    })),
  ])
  pluginManager.createPluggableElements()
  const RootModel = JBrowseRootModelFactory({
    pluginManager,
    sessionModelFactory,
    adminMode: !!self.adminKey,
  })

  if (!self.configSnapshot) {
    return undefined
  }
  const rootModel = RootModel.create(
    {
      jbrowse: self.configSnapshot,
      configPath: self.configPath,
    },
    { pluginManager },
  )

  // @ts-expect-error
  if (!self.configSnapshot.configuration?.rpc?.defaultDriver) {
    rootModel.jbrowse.configuration.rpc.defaultDriver.set('WebWorkerRpcDriver')
  }

  let afterInitializedCb = () => {}

  // in order: saves the previous autosave for recovery, tries to load the
  // local session if session in query, or loads the default session
  try {
    if (self.sessionError) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw self.sessionError
    } else if (self.sessionSnapshot) {
      rootModel.setSession(self.sessionSnapshot)
    } else if (self.sessionSpec) {
      // @ts-expect-error
      afterInitializedCb = loadSessionSpec(self.sessionSpec, pluginManager)
    } else if (rootModel.jbrowse.defaultSession?.views?.length) {
      rootModel.setDefaultSession()
    }
  } catch (e) {
    rootModel.setDefaultSession()
    const str = `${e}`
    const m = str.replace('[mobx-state-tree] ', '').replace(/\(.+/, '')
    const r = m.length > 1000 ? `${m.slice(0, 1000)}...see more in console` : m
    const s = r.startsWith('Error:') ? r : `Error: ${r}`
    rootModel.session?.notifyError(
      `${s}. If you received this URL from another user, request that they send you a session generated with the "Share" button instead of copying and pasting their URL`,
      self.sessionError,
      self.sessionSnapshot,
    )
    console.error(e)
  }

  // send analytics
  doAnalytics(rootModel, self.initialTimestamp, self.sessionQuery)

  pluginManager.setRootModel(rootModel)
  pluginManager.configure()
  afterInitializedCb()
  return pluginManager
}
