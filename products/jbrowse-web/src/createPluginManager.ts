import PluginManager from '@jbrowse/core/PluginManager'
import { doAnalytics } from '@jbrowse/core/util/analytics'
import {
  restoreFileHandlesFromSnapshot,
  setPendingFileHandleIds,
} from '@jbrowse/core/util/tracks'

import corePlugins from './corePlugins.ts'
import { loadHubSpec } from './loadHubSpec.ts'
import { loadSessionSpec } from './loadSessionSpec.ts'
import JBrowseRootModelFactory from './rootModel/rootModel.ts'
import sessionModelFactory from './sessionModel/index.ts'

import type { SessionLoaderModel } from './SessionLoader.ts'

async function preLoadConnectionTracks(
  sessionSnapshot: Record<string, unknown>,
  configSnapshot: Record<string, unknown>,
  pluginManager: PluginManager,
) {
  const connectionInstances = sessionSnapshot.connectionInstances as
    | Record<string, unknown>[]
    | undefined
  if (!connectionInstances?.length) {
    return sessionSnapshot
  }

  const allConnections = [
    ...((configSnapshot.connections as Record<string, unknown>[]) ?? []),
    ...((sessionSnapshot.sessionConnections as Record<string, unknown>[]) ??
      []),
  ]

  const enrichedInstances = await Promise.all(
    connectionInstances.map(async connInstance => {
      const configRef = connInstance.configuration
      const configId =
        typeof configRef === 'string'
          ? configRef
          : (configRef as Record<string, unknown> | undefined)?.connectionId
      const config = allConnections.find(c => c.connectionId === configId)
      if (!config) {
        return connInstance
      }

      const connectionType = pluginManager.getConnectionType(
        connInstance.type as string,
      )
      if (!connectionType?.fetchTracks) {
        return connInstance
      }

      try {
        const tracks = await connectionType.fetchTracks(config)
        return { ...connInstance, tracks }
      } catch (e) {
        console.error(
          `Failed to pre-load tracks for connection ${connInstance.name}:`,
          e,
        )
        return connInstance
      }
    }),
  )

  return { ...sessionSnapshot, connectionInstances: enrichedInstances }
}

export async function createPluginManager(
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
      const {
        sessionError,
        sessionSpec,
        sessionSnapshot,
        hubSpec,
        sessionName,
      } = model
      if (sessionError) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw sessionError
      } else if (sessionSnapshot) {
        // Attempt to restore file handles from the session snapshot
        // This is async but we kick it off before setting the session
        // If permission is already granted (persisted), files will be available
        // If not, user will need to click to grant permission
        restoreFileHandlesFromSnapshot(sessionSnapshot, false)
          .then(results => {
            const failed = results.filter(r => !r.success)
            if (failed.length > 0) {
              const failedIds = failed.map(f => f.handleId)
              console.warn(
                '[createPluginManager] Some file handles could not be restored (need user gesture):',
                failedIds,
              )
              // Track failed handles so UI can prompt user
              setPendingFileHandleIds(failedIds)
            }
          })
          .catch((err: unknown) => {
            console.error(
              '[createPluginManager] Error restoring file handles:',
              err,
            )
          })
        const enrichedSnapshot = await preLoadConnectionTracks(
          sessionSnapshot,
          model.configSnapshot,
          pluginManager,
        )
        rootModel.setSession(enrichedSnapshot)
      } else if (hubSpec) {
        afterInitializedCb = () =>
          // @ts-expect-error
          loadHubSpec({ ...hubSpec, sessionName }, pluginManager)
      } else if (sessionSpec) {
        afterInitializedCb = () =>
          // @ts-expect-error
          loadSessionSpec({ ...sessionSpec, sessionName }, pluginManager)
      } else {
        rootModel.setDefaultSession()
        if (sessionName) {
          rootModel.renameCurrentSession(sessionName)
        }
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
