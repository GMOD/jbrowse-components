import { loadSessionSpec } from '@jbrowse/app-core'
import { pluginUrl } from '@jbrowse/core/PluginLoader'
import PluginManager from '@jbrowse/core/PluginManager'
import { doAnalytics } from '@jbrowse/core/util/analytics'

import { applyDefaultSessionViewInit } from './applyDefaultSessionViewInit.ts'
import corePlugins from './corePlugins.ts'
import { loadHubSpec } from './loadHubSpec.ts'
import JBrowseRootModelFactory from './rootModel/rootModel.ts'
import sessionModelFactory from './sessionModel/index.ts'

import type { WebRootModel } from './rootModel/rootModel.ts'
import type { SessionSource } from './types.ts'
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
  readonly sessionSource?: SessionSource
  readonly sessionName?: string
  readonly initialTimestamp: number
  readonly sessionQuery?: string
  readonly defaultSessionViewInit?: {
    loc?: string
    assembly?: string
    tracks?: string[]
    tracklist?: boolean
    nav?: boolean
    highlight?: string[]
  }
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

  const rootModel = JBrowseRootModelFactory({
    pluginManager,
    sessionModelFactory,
    adminMode: !!model.adminKey,
  }).create(
    {
      jbrowse: model.configSnapshot,
      configPath: model.configPath,
    },
    { pluginManager },
  )
  rootModel.setReloadPluginManagerCallback(reloadPluginManagerCallback)

  // configure() before initSession so hub/spec sessions see registered
  // views/tracks/extension-points; safe because configure() doesn't read
  // session state
  pluginManager.setRootModel(rootModel).configure()
  doAnalytics(rootModel, model.initialTimestamp, model.sessionQuery)
  initSession(rootModel, pluginManager, model)
  return pluginManager
}

// Applies the single session the loader resolved. The loader already
// discriminated which kind of session this is; here we just dispatch on
// sessionSource.type. Any failure (a resolved error, or a thrown snapshot)
// falls back to the default session with a user-facing notification.
function initSession(
  rootModel: WebRootModel,
  pluginManager: PluginManager,
  model: PluginManagerSource,
) {
  const { sessionSource, sessionName, defaultSessionViewInit } = model
  try {
    if (sessionSource?.type === 'error') {
      throw sessionSource.error
    } else if (sessionSource?.type === 'snapshot') {
      rootModel.setSession(sessionSource.snapshot)
    } else if (sessionSource?.type === 'hub') {
      // @ts-expect-error hubSpec is dynamic JSON (Record<string,unknown>); the
      // required shape is validated at runtime inside loadHubSpec
      void loadHubSpec({ ...sessionSource.hubSpec, sessionName }, pluginManager)
    } else if (sessionSource?.type === 'spec') {
      void loadSessionSpec(
        // @ts-expect-error spec is dynamic JSON (Record<string,unknown>); the
        // required shape is validated at runtime inside loadSessionSpec
        { ...sessionSource.spec, sessionName },
        pluginManager,
      )
    } else {
      rootModel.setDefaultSession()
      if (defaultSessionViewInit) {
        applyDefaultSessionViewInit(rootModel.session, defaultSessionViewInit)
      }
      if (sessionName) {
        rootModel.renameCurrentSession(sessionName)
      }
    }
  } catch (e) {
    rootModel.setDefaultSession()
    rootModel.session?.notifyError(
      `${formatSessionError(e)}. If you received this URL from another user, request that they send you a session generated with the "Share" button instead of copying and pasting their URL`,
      e,
      sessionSource?.type === 'snapshot' ? sessionSource.snapshot : undefined,
    )
    console.error(e)
  }
}
