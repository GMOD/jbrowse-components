import PluginManager from '@jbrowse/core/PluginManager'
import { createEmbeddedRootModel } from '@jbrowse/embedded-core'
import { toPluginLoadRecord } from '@jbrowse/product-core'

import corePlugins from '../corePlugins.ts'
import { version } from '../version.ts'
import createSessionModel from './createSessionModel.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'
import type { PluginInput } from '@jbrowse/product-core'

/**
 * #stateModel JBrowseReactCircularGenomeViewRootModel
 * #internal thin product wrapper that declares no members of its own — the
 * documented surface is EmbeddedRootModel, so this gets no website page
 * #category root
 * Composes the shared {@link EmbeddedRootModel} with a CircularView session.
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
    name: 'ReactCircularGenomeView',
    version,
    pluginManager,
    sessionModelType: createSessionModel(pluginManager),
    makeWorkerInstance,
  })
  return { model, pluginManager }
}

type ViewStateModel = ReturnType<typeof createModel>['model']
export type ViewModel = Instance<ViewStateModel>
