import { pluginUrl } from '@jbrowse/core/PluginLoader'
import PluginManager from '@jbrowse/core/PluginManager'
import { doAnalytics } from '@jbrowse/core/util/analytics'

import corePlugins from './corePlugins.ts'
import { loadHubSpec } from './loadHubSpec.ts'
import { loadSessionSpec } from './loadSessionSpec.ts'
import JBrowseRootModelFactory from './rootModel/rootModel.ts'
import sessionModelFactory from './sessionModel/index.ts'

import type { PluginRecord } from '@jbrowse/core/PluginLoader'

// Structural read-only view of SessionLoader. Kept narrow so it can be
// satisfied both by an Instance<SessionLoader> and by `self` inside an MST
// action chain (which doesn't yet expose the full action set).
export interface PluginManagerSource {
  readonly runtimePlugins?: readonly PluginRecord[]
  readonly sessionPlugins?: readonly PluginRecord[]
  readonly configSnapshot?: Record<string, unknown>
  readonly configPath?: string
  readonly adminKey?: string
  readonly sessionError: unknown
  readonly sessionSpec?: Record<string, unknown>
  readonly sessionSnapshot?: Record<string, unknown>
  readonly hubSpec?: Record<string, unknown>
  readonly sessionName?: string
  readonly initialTimestamp: number
  readonly sessionQuery?: string
}

function asPluginRecord({ plugin: P, definition }: PluginRecord) {
  return {
    plugin: new P(),
    definition,
    metadata: { url: pluginUrl(definition) },
  }
}

function formatSessionError(e: unknown) {
  const m = `${e}`
    .replace('[@jbrowse/mobx-state-tree] ', '')
    .replace(/\(.+/, '')
  const r = m.length > 1000 ? `${m.slice(0, 1000)}...see more in console` : m
  return r.startsWith('Error:') ? r : `Error: ${r}`
}

export function createPluginManager(
  model: PluginManagerSource,
  reloadPluginManagerCallback: (
    configSnapshot: Record<string, unknown>,
    sessionSnapshot: Record<string, unknown>,
  ) => void,
) {
  const pluginManager = new PluginManager([
    ...corePlugins.map(P => ({ plugin: new P(), metadata: { isCore: true } })),
    ...(model.runtimePlugins ?? []).map(asPluginRecord),
    ...(model.sessionPlugins ?? []).map(asPluginRecord),
  ]).createPluggableElements()

  const RootModel = JBrowseRootModelFactory({
    pluginManager,
    sessionModelFactory,
    adminMode: !!model.adminKey,
  })

  const rootModel = RootModel.create(
    {
      jbrowse: model.configSnapshot,
      configPath: model.configPath,
    },
    { pluginManager },
  )

  rootModel.setReloadPluginManagerCallback(reloadPluginManagerCallback)

  const configuredRpc = (
    model.configSnapshot as {
      configuration?: { rpc?: { defaultDriver?: unknown } }
    }
  ).configuration?.rpc?.defaultDriver
  if (!configuredRpc) {
    rootModel.jbrowse.configuration.rpc.defaultDriver.set('WebWorkerRpcDriver')
  }

  const { sessionError, sessionSpec, sessionSnapshot, hubSpec, sessionName } =
    model

  // hub/spec sessions need a configured pluginManager (views/tracks registered)
  // so they are deferred until after pluginManager.configure() below
  let initAfterConfigure: (() => unknown) | undefined

  // in order: saves the previous autosave for recovery, tries to load the
  // local session if session in query, or loads the default session
  try {
    if (sessionError) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw sessionError
    } else if (sessionSnapshot) {
      rootModel.setSession(sessionSnapshot)
    } else if (hubSpec) {
      initAfterConfigure = () =>
        // @ts-expect-error hubSpec is dynamic JSON (Record<string,unknown>); the
        // required shape is validated at runtime inside loadHubSpec
        loadHubSpec({ ...hubSpec, sessionName }, pluginManager)
    } else if (sessionSpec) {
      initAfterConfigure = () =>
        // @ts-expect-error sessionSpec is dynamic JSON (Record<string,unknown>);
        // the required shape is validated at runtime inside loadSessionSpec
        loadSessionSpec({ ...sessionSpec, sessionName }, pluginManager)
    } else {
      rootModel.setDefaultSession()
      if (sessionName) {
        rootModel.renameCurrentSession(sessionName)
      }
    }
  } catch (e) {
    rootModel.setDefaultSession()
    rootModel.session?.notifyError(
      `${formatSessionError(e)}. If you received this URL from another user, request that they send you a session generated with the "Share" button instead of copying and pasting their URL`,
      model.sessionError,
      model.sessionSnapshot,
    )
    console.error(e)
  }

  doAnalytics(rootModel, model.initialTimestamp, model.sessionQuery)
  pluginManager.setRootModel(rootModel)
  pluginManager.configure()
  initAfterConfigure?.()
  return pluginManager
}
