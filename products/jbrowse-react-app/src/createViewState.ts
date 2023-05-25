import { PluginConstructor } from '@jbrowse/core/Plugin'
import { onPatch, IJsonPatch, SnapshotIn } from 'mobx-state-tree'
import { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'

// locals
import createModel from './createModel'

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
interface SessionSnapshot {
  name: string
  [key: string]: unknown
}
interface Config {
  assemblies: SnapshotIn<BaseAssemblyConfigSchema>[]
  tracks: TrackConfig[]
  internetAccounts?: InternetAccountConfig[]
  aggregateTextSearchAdapters?: TextSearchAdapterConfig[]
  configuration?: Record<string, unknown>
  defaultSession?: SessionSnapshot
}

export default function createViewState(opts: {
  config: Config
  plugins?: PluginConstructor[]
  onChange?: (patch: IJsonPatch, reversePatch: IJsonPatch) => void
  makeWorkerInstance?: () => Worker
}) {
  const { config, plugins = [], onChange, makeWorkerInstance } = opts
  const { defaultSession = { name: 'NewSession' } } = config
  const { model, pluginManager } = createModel(plugins, makeWorkerInstance)
  const stateTree = model.create(
    {
      jbrowse: config,
      session: defaultSession,
    },
    { pluginManager },
  )

  pluginManager.setRootModel(stateTree)
  pluginManager.configure()

  if (onChange) {
    onPatch(stateTree, onChange)
  }
  return stateTree
}
