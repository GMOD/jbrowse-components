import PluginManager from '@jbrowse/core/PluginManager'
import { createEmbeddedRootModel } from '@jbrowse/embedded-core'
import { types } from '@jbrowse/mobx-state-tree'

import corePlugins from '../corePlugins.ts'
import { version } from '../version.ts'
import createSessionModel from './createSessionModel.ts'

import type { PluginConstructor } from '@jbrowse/core/Plugin'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel JBrowseReactLinearGenomeViewRootModel
 * #category root
 * Composes the shared {@link EmbeddedRootModel} with a LinearGenomeView session
 * plus the LGV-only `disableAddTracks`/`drawerViewHeight` props.
 */
export default function createModel(
  runtimePlugins: PluginConstructor[],
  makeWorkerInstance?: () => Worker,
) {
  const pluginManager = new PluginManager(
    [...corePlugins, ...runtimePlugins].map(P => new P()),
  ).createPluggableElements()
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
