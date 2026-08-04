import PluginManager from '@jbrowse/core/PluginManager'
import { toPluginLoadRecord } from '@jbrowse/product-core'

import corePlugins from './corePlugins.ts'
import createRootModel from './rootModel/rootModel.ts'
import sessionModelFactory from './sessionModel/index.ts'

import type { PluginInput } from './types.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

export default function createModel({
  runtimePlugins,
  makeWorkerInstance,
}: {
  runtimePlugins: PluginInput[]
  makeWorkerInstance?: () => Worker
}) {
  const pluginManager = new PluginManager([
    ...corePlugins.map(P => ({ plugin: new P(), metadata: { isCore: true } })),
    // keeps each runtime plugin's `definition`, which is what the RPC worker
    // boots from — see toPluginLoadRecord
    ...runtimePlugins.map(toPluginLoadRecord),
  ]).createPluggableElements()

  return {
    model: createRootModel({
      pluginManager,
      sessionModelFactory,
      makeWorkerInstance,
    }),
    pluginManager,
  }
}

type ViewStateModel = ReturnType<typeof createModel>['model']
export type ViewModel = Instance<ViewStateModel>
