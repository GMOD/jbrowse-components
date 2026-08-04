import type { PluginConstructor } from '@jbrowse/core/Plugin'
import type { PluginRecord } from '@jbrowse/core/PluginLoader'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'
import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'
import type { SnapshotIn } from '@jbrowse/mobx-state-tree'

interface TextSearchAdapterConfig {
  textSearchAdapterId: string
  [key: string]: unknown
}
interface InternetAccountConfig {
  internetAccountId: string
  [key: string]: unknown
}
interface TrackConfig {
  trackId: string
  [key: string]: unknown
}

/**
 * A serialized session — what `getSnapshot(viewState.session)` produces, what
 * `decodeSession` returns, and what the `session` option restores. Open-shaped
 * on purpose: the concrete shape is the session model's `SnapshotIn`, which
 * grows with every plugin the host loads.
 */
export interface SessionSnapshot {
  name: string
  [key: string]: unknown
}

/**
 * A plugin to register: either the class itself, or the `{ plugin, definition }`
 * record `loadPlugins` returns.
 *
 * Prefer passing the record straight through. The `definition` is what lets the
 * RPC worker load the same plugin on its side — hand it only the class and the
 * plugin exists on the main thread but not in the worker, so anything it
 * contributes that runs there (an adapter, most commonly) fails to resolve.
 */
export type PluginInput = PluginConstructor | PluginRecord

export interface Config {
  assemblies: SnapshotIn<BaseAssemblyConfigSchema>[]
  tracks?: TrackConfig[]
  internetAccounts?: InternetAccountConfig[]
  aggregateTextSearchAdapters?: TextSearchAdapterConfig[]
  configuration?: Record<string, unknown>
  defaultSession?: SessionSnapshot
  /**
   * Plugins this config names, as a jbrowse-web `config.json` carries them.
   * Unlike jbrowse-web, the embedded app does not fetch them for you: loading a
   * plugin is async and `createViewState` is synchronous. Await
   * `loadPlugins(config.plugins)` and pass the result as the `plugins` option.
   */
  plugins?: PluginDefinition[]
}
