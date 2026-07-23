import PluginManager from '@jbrowse/core/PluginManager'
import { createEmbeddedRootModel } from '@jbrowse/embedded-core'

import corePlugins from '../corePlugins.ts'
import { version } from '../version.ts'
import createSessionModel from './createSessionModel.ts'

import type { PluginConstructor } from '@jbrowse/core/Plugin'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel JBrowseReactCircularGenomeViewRootModel
 * #internal thin product wrapper that declares no members of its own — the
 * documented surface is EmbeddedRootModel, so this gets no website page
 * #category root
 * Composes the shared {@link EmbeddedRootModel} with a CircularView session.
 */
export default function createModel(
  runtimePlugins: PluginConstructor[],
  makeWorkerInstance?: () => Worker,
) {
  const pluginManager = new PluginManager(
    [...corePlugins, ...runtimePlugins].map(P => new P()),
  ).createPluggableElements()
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
