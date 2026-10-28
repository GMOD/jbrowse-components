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
 * `session` is restated because the base root's is a `types.maybe`, and
 * `createViewState` never builds a root without one, so every consumer of a
 * `ViewModel` gets the resolved value rather than a `!` at each use.
 */
export interface ViewModel extends Omit<Instance<ViewStateModel>, 'session'> {
  session: WebSessionModel
}

export function hasSession(
  root: Instance<ViewStateModel>,
): root is Instance<ViewStateModel> & ViewModel {
  return root.session !== undefined
}
