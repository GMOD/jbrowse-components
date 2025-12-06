import PluginManager from '@jbrowse/core/PluginManager'

import corePlugins from './corePlugins'
import createRootModel from './rootModel/rootModel'

import type { PluginConstructor } from '@jbrowse/core/Plugin'
import type { Instance } from '@jbrowse/mobx-state-tree'

export default function createModel({
  runtimePlugins,
  makeWorkerInstance = () => {
    throw new Error('no makeWorkerInstance supplied')
  },
}: {
  runtimePlugins: PluginConstructor[]
  makeWorkerInstance?: () => Worker
}) {
  const pluginManager = new PluginManager([
    ...corePlugins.map(P => ({ plugin: new P(), metadata: { isCore: true } })),
    ...runtimePlugins.map(P => new P()),
  ]).createPluggableElements()

  return {
    model: createRootModel({
      pluginManager,
      makeWorkerInstance,
    }),
    pluginManager,
  }
}

export type ViewStateModel = ReturnType<typeof createModel>['model']
export type ViewModel = Instance<ViewStateModel>
