import PluginManager from '@jbrowse/core/PluginManager'
import { doAnalytics } from '@jbrowse/core/util/analytics'

import corePlugins from './corePlugins'
import { loadHubSpec } from './loadHubSpec'
import { loadSessionSpec } from './loadSessionSpec'
import JBrowseRootModelFactory from './rootModel/rootModel'
import sessionModelFactory from './sessionModel'

import type { SessionLoaderModel } from './SessionLoader'

export function createPluginManager(
  model: SessionLoaderModel,
  reloadPluginManagerCallback: (
    configSnapshot: Record<string, unknown>,
    sessionSnapshot: Record<string, unknown>,
  ) => void,
) {
  // it is ready when a session has loaded and when there is no config error
  //
  // Assuming that the query changes model.sessionError or
  // model.sessionSnapshot or model.blankSession
  const pluginManager = new PluginManager([
    ...corePlugins.map(P => ({
      plugin: new P(),
      metadata: { isCore: true },
    })),
    ...(model.runtimePlugins ?? []).map(({ plugin: P, definition }) => ({
      plugin: new P(),
      definition,
      metadata: {
        // @ts-expect-error
        url: definition.url,
      },
    })),
    ...(model.sessionPlugins ?? []).map(({ plugin: P, definition }) => ({
      plugin: new P(),
      definition,
      metadata: {
        // @ts-expect-error
        url: definition.url,
      },
    })),
  ]).createPluggableElements()

  const RootModel = JBrowseRootModelFactory({
    pluginManager,
    sessionModelFactory,
    adminMode: !!model.adminKey,
  })

  if (model.configSnapshot) {
    const rootModel = RootModel.create(
      {
        jbrowse: model.configSnapshot,
        configPath: model.configPath,
      },
      { pluginManager },
    )

    rootModel.setReloadPluginManagerCallback(reloadPluginManagerCallback)

    // @ts-expect-error
    if (!model.configSnapshot.configuration?.rpc?.defaultDriver) {
      rootModel.jbrowse.configuration.rpc.defaultDriver.set(
        'WebWorkerRpcDriver',
      )
    }

    let afterInitializedCb = () => {}

    // in order: saves the previous autosave for recovery, tries to load the
    // local session if session in query, or loads the default session
    try {
      const { sessionError, sessionSpec, sessionSnapshot, hubSpec } = model
      if (sessionError) {
        throw new Error(sessionError)
      } else if (sessionSnapshot) {
        rootModel.setSession(sessionSnapshot)
      } else if (hubSpec) {
        // @ts-expect-error
        afterInitializedCb = () => loadHubSpec(hubSpec, pluginManager)
      } else if (sessionSpec) {
        // @ts-expect-error
        afterInitializedCb = () => loadSessionSpec(sessionSpec, pluginManager)
      } else {
        rootModel.setDefaultSession()
      }
    } catch (e) {
      rootModel.setDefaultSession()
      const str = `${e}`
      const m = str
        .replace('[@jbrowse/mobx-state-tree] ', '')
        .replace(/\(.+/, '')
      const r =
        m.length > 1000 ? `${m.slice(0, 1000)}...see more in console` : m
      const s = r.startsWith('Error:') ? r : `Error: ${r}`
      rootModel.session?.notifyError(
        `${s}. If you received this URL from another user, request that they send you a session generated with the "Share" button instead of copying and pasting their URL`,
        model.sessionError,
        model.sessionSnapshot,
      )
      console.error(e)
    }

    // send analytics
    doAnalytics(rootModel, model.initialTimestamp, model.sessionQuery)

    pluginManager.setRootModel(rootModel)
    pluginManager.configure()
    afterInitializedCb()
    return pluginManager
  } else {
    return undefined
  }
}
