import { PluginConstructor } from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { Instance } from 'mobx-state-tree'
import corePlugins from '../corePlugins'
import createRootModel from '../rootModel'

type WorkerCb = () => Worker

export default function createModel(
  runtimePlugins: PluginConstructor[],
  makeWorkerInstance: WorkerCb = () => {
    throw new Error('no makeWorkerInstance supplied')
  },
) {
  const pluginManager = new PluginManager([
    ...corePlugins.map(P => ({
      plugin: new P(),
      metadata: { isCore: true },
    })),
    ...runtimePlugins.map(P => new P()),
  ])
  pluginManager.createPluggableElements()
  const rootModel = createRootModel(pluginManager, false, makeWorkerInstance)
  return { model: rootModel, pluginManager }
}

export type ViewStateModel = ReturnType<typeof createModel>['model']
export type ViewModel = Instance<ViewStateModel>
