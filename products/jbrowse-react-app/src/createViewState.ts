import { onPatch } from '@jbrowse/mobx-state-tree'

import createModel from './createModel.ts'

import type { Config } from './types.ts'
import type { PluginConstructor } from '@jbrowse/core/Plugin'
import type { IJsonPatch } from '@jbrowse/mobx-state-tree'

export default function createViewState(opts: {
  config: Config
  plugins?: PluginConstructor[]
  onChange?: (patch: IJsonPatch, reversePatch: IJsonPatch) => void
  makeWorkerInstance?: () => Worker
}) {
  const { config, plugins = [], onChange, makeWorkerInstance } = opts
  const { defaultSession = { name: 'NewSession' } } = config
  const { model, pluginManager } = createModel({
    runtimePlugins: plugins,
    makeWorkerInstance,
  })
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
