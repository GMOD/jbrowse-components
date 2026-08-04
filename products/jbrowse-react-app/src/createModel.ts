import PluginManager from '@jbrowse/core/PluginManager'

import corePlugins from './corePlugins.ts'
import createRootModel from './rootModel/rootModel.ts'
import sessionModelFactory from './sessionModel/index.ts'

import type { PluginInput } from './types.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

// A plugin class is a function; loadPlugins' record is an object pairing the
// class with the `definition` it was loaded from. Keeping that definition on
// the load record is what populates PluginManager.runtimePluginDefinitions —
// the list RpcManager ships to the RPC worker as its boot config so the worker
// loads the same plugin. Dropping it leaves the plugin main-thread-only, and
// anything it contributes that runs in the worker fails to resolve there.
function toLoadRecord(p: PluginInput) {
  return typeof p === 'function'
    ? { plugin: new p() }
    : { plugin: new p.plugin(), definition: p.definition }
}

export default function createModel({
  runtimePlugins,
  makeWorkerInstance,
}: {
  runtimePlugins: PluginInput[]
  makeWorkerInstance?: () => Worker
}) {
  const pluginManager = new PluginManager([
    ...corePlugins.map(P => ({ plugin: new P(), metadata: { isCore: true } })),
    ...runtimePlugins.map(toLoadRecord),
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
