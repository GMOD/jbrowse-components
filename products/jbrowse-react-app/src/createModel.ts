import PluginManager from '@jbrowse/core/PluginManager'
import ReExports from '@jbrowse/core/ReExports'

import corePlugins from './corePlugins.ts'
import createRootModel from './rootModel/rootModel.ts'
import sessionModelFactory from './sessionModel/index.ts'

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
  const pluginManager = new PluginManager(
    [
      ...corePlugins.map(P => ({ plugin: new P(), metadata: { isCore: true } })),
      ...runtimePlugins.map(P => new P()),
    ],
    { reExports: ReExports },
  ).createPluggableElements()

  return {
    model: createRootModel({
      pluginManager,
      sessionModelFactory,
      makeWorkerInstance,
    }),
    pluginManager,
  }
}

export type ViewStateModel = ReturnType<typeof createModel>['model']
export type ViewModel = Instance<ViewStateModel>
