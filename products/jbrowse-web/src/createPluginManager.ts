import PluginManager from '@jbrowse/core/PluginManager'
import { doAnalytics } from '@jbrowse/core/util/analytics'

// locals
import JBrowseRootModelFactory from './rootModel/rootModel'
import sessionModelFactory from './sessionModel'
import corePlugins from './corePlugins'
import { SessionLoaderModel, loadSessionSpec } from './SessionLoader'

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
      metadata: { url: definition.url },
    })),
    ...self.sessionPlugins.map(({ plugin: P, definition }) => ({
      plugin: new P(),
      definition,
      metadata: { url: definition.url },
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
  if (!self.configSnapshot?.configuration?.rpc?.defaultDriver) {
    rootModel.jbrowse.configuration.defaultDriver.set('WebWorkerRpcDriver')
  }

  let afterInitializedCb = () => {}

  // in order: saves the previous autosave for recovery, tries to
  // load the local session if session in query, or loads the default
  // session
  try {
    if (self.sessionError) {
      rootModel.setDefaultSession()
      rootModel.session.notify(
        `Error loading session: ${self.sessionError}. If you received this URL from another user, request that they send you a session generated with the "Share" button instead of copying and pasting their URL`,
      )
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
    const errorMessage = str
      .replace('[mobx-state-tree] ', '')
      .replace(/\(.+/, '')
    rootModel.session?.notify(
      `Session could not be loaded. ${
        errorMessage.length > 1000
          ? `${errorMessage.slice(0, 1000)}...see more in console`
          : errorMessage
      }`,
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
