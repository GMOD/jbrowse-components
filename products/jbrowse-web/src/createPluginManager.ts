import PluginManager from '@jbrowse/core/PluginManager'
import { doAnalytics } from '@jbrowse/core/util/analytics'
import {
  restoreFileHandlesFromSnapshot,
  setPendingFileHandleIds,
} from '@jbrowse/core/util/tracks'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { when } from 'mobx'

import corePlugins from './corePlugins.ts'
import { loadHubSpec } from './loadHubSpec.ts'
import { loadSessionSpec } from './loadSessionSpec.ts'
import JBrowseRootModelFactory from './rootModel/rootModel.ts'
import sessionModelFactory from './sessionModel/index.ts'

import type { SessionLoaderModel } from './SessionLoader.ts'

export async function waitForConnectionsLoaded(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: any,
  onStatus?: (message: string) => void,
) {
  const connections = [...session.connectionInstances]
  if (connections.length === 0) {
    return
  }

  await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connections.map((conn: any) => {
      onStatus?.(`Loading connection "${conn.name}"...`)
      return when(() => !isAlive(conn) || conn.tracks.length > 0)
    }),
  )
}

export async function createPluginManager(
  model: SessionLoaderModel,
  reloadPluginManagerCallback: (
    configSnapshot: Record<string, unknown>,
    sessionSnapshot: Record<string, unknown>,
  ) => void,
  onStatus?: (message: string) => void,
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

        const { views, ...sessionWithoutViews } = sessionSnapshot
        const hasConnections = (
          sessionWithoutViews.connectionInstances as unknown[] | undefined
        )?.length

        if (hasConnections) {
          // Set session without views first. Connection instances are created
          // and afterAttach fires connect() to fetch tracks.
          rootModel.setSession({ ...sessionWithoutViews, views: [] })

          // Wait for all connections to load tracks (or fail/break)
          await waitForConnectionsLoaded(rootModel.session, onStatus)

          // Now restore views — track config references can resolve
          if (views && Array.isArray(views)) {
            for (const view of views) {
              // @ts-expect-error
              rootModel.session.addView(view.type, view)
            }
          }
        } else {
          rootModel.setSession(sessionSnapshot)
        }
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
