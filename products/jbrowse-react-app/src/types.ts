import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'
import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'
import type { SnapshotIn } from '@jbrowse/mobx-state-tree'
import type {
  AssemblyInput,
  LocalFileInput,
  PluginInput,
  ResolvedAssemblies,
  SessionObservers,
  SessionSnapshot,
  ViewLocation,
} from '@jbrowse/product-core'

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
interface ConnectionConfig {
  connectionId: string
  [key: string]: unknown
}

// re-exported so hosts get them from this package rather than reaching into
// product-core; all of them are shared with the other embedded products
export type {
  AssemblyInput,
  LocalFileInput,
  PluginInput,
  ResolvedAssemblies,
  SessionObservers,
  SessionSnapshot,
  ViewLocation,
}

export interface Config {
  assemblies: SnapshotIn<BaseAssemblyConfigSchema>[]
  tracks?: TrackConfig[]
  /**
   * Connections this app offers — a UCSC track hub, a JBrowse 1 data directory.
   * They are listed in the track selector and fetched when the user opens one,
   * the same as a connection added through File → Open connection.
   */
  connections?: ConnectionConfig[]
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
