import PluginManager, { corePluginRecords } from '@jbrowse/core/PluginManager'
import { toPluginLoadRecord } from '@jbrowse/product-core'

import corePlugins from './corePlugins.ts'
import createRootModel from './rootModel/rootModel.ts'
import sessionModelFactory from './sessionModel/index.ts'

import type { WebSessionModel } from './sessionModel/index.ts'
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
    ...corePluginRecords(corePlugins),
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

/**
 * The engine `createViewState` hands back — the app's MST root.
 *
 * `session` is restated for two reasons. Product-core's `BaseRootModel` takes
 * the session model as an erased `IAnyType` — it can't name a per-product
 * session type without a root↔session cycle — so `Instance<…>['session']`
 * degrades to `any`, and nothing anyone reads through it is checked. And the
 * property is a `types.maybe` because that base root allows a root with no
 * session yet; `createViewState` never builds one, so every consumer of a
 * `ViewModel` gets the resolved value rather than a `!` at each use.
 */
export interface ViewModel extends Omit<Instance<ViewStateModel>, 'session'> {
  session: WebSessionModel
}
