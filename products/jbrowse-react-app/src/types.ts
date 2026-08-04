import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'
import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'
import type { SnapshotIn } from '@jbrowse/mobx-state-tree'
import type { PluginInput, SessionSnapshot } from '@jbrowse/product-core'

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

// re-exported so hosts get them from this package rather than reaching into
// product-core; both are shared with the other embedded products
export type { PluginInput, SessionSnapshot }

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
