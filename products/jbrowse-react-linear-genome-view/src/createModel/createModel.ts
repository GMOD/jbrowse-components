import PluginManager from '@jbrowse/core/PluginManager'
import { createEmbeddedRootModel } from '@jbrowse/embedded-core'
import { types } from '@jbrowse/mobx-state-tree'
import { toPluginLoadRecord } from '@jbrowse/product-core'

import corePlugins from '../corePlugins.ts'
import { version } from '../version.ts'
import createSessionModel from './createSessionModel.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'
import type { PluginInput } from '@jbrowse/product-core'

/**
 * #stateModel JBrowseReactLinearGenomeViewRootModel
 * #category root
 * Composes the shared {@link EmbeddedRootModel} with a LinearGenomeView session
 * plus the LGV-only `disableAddTracks`/`drawerViewHeight` props.
 */
export default function createModel(
  runtimePlugins: PluginInput[],
  makeWorkerInstance?: () => Worker,
) {
  const pluginManager = new PluginManager([
    ...corePlugins.map(P => ({ plugin: new P() })),
    // keeps each runtime plugin's `definition`, which is what the RPC worker
    // boots from — see toPluginLoadRecord
    ...runtimePlugins.map(toPluginLoadRecord),
  ]).createPluggableElements()
  const model = createEmbeddedRootModel({
    name: 'ReactLinearGenomeView',
    version,
    pluginManager,
    sessionModelType: createSessionModel(pluginManager),
    makeWorkerInstance,
  }).props({
    /**
     * #property
     */
    disableAddTracks: types.stripDefault(types.boolean, false),
    /**
     * #property
     */
    drawerViewHeight: types.stripDefault(types.string, '100vh'),
  })
  return { model, pluginManager }
}

type ViewStateModel = ReturnType<typeof createModel>['model']
export type ViewModel = Instance<ViewStateModel>
