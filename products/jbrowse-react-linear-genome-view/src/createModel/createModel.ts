import PluginManager from '@jbrowse/core/PluginManager'
import { createEmbeddedRootModel } from '@jbrowse/embedded-core'
import { types } from '@jbrowse/mobx-state-tree'
import { toPluginLoadRecord } from '@jbrowse/product-core'

import corePlugins from '../corePlugins.ts'
import { version } from '../version.ts'
import createSessionModel from './createSessionModel.ts'

import type { IsAny } from '@jbrowse/core/util/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { AssertNotAny, PluginInput } from '@jbrowse/product-core'

/**
 * #stateModel JBrowseReactLinearGenomeViewRootModel
 * #category root
 * Composes the shared {@link EmbeddedRootModel} with a LinearGenomeView session
 * plus the LGV-only `disableAddTracks`/`height` props.
 */
export default function createModel(
  runtimePlugins: PluginInput[],
  makeWorkerInstance?: () => Worker,
) {
  const pluginManager = new PluginManager([
    // `isCore` is what tells the plugin store these came with the bundle:
    // InstalledPluginsList filters them out, and without it every bundled
    // plugin is listed as one the user installed, with an uninstall button
    ...corePlugins.map(P => ({ plugin: new P(), metadata: { isCore: true } })),
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
     * Any CSS height, applied to the component's own root whether or not a
     * drawer is open. Absent, the component is content-height and grows with
     * the page, and the host's box is what bounds it.
     */
    height: types.maybe(types.string),
    /**
     * #property
     * Superseded by `height`, which does the same thing without the "only
     * while a drawer is open" condition. Still honored when `height` is
     * absent.
     */
    drawerViewHeight: types.stripDefault(types.string, '100vh'),
  })
  return { model, pluginManager }
}

type ViewStateModel = ReturnType<typeof createModel>['model']
// `interface … extends`, not `type … =`, and this one is load-bearing for the
// BUILD rather than for the usual mutual-reference reason: as an alias the
// declaration emitter inlines the whole root-model type at every use, and both
// `createViewState` and `useCreateViewState` then fail `build:esm` with TS7056
// — the inferred type is too long to serialize. The interface gives it a name
// to emit instead. Annotate anything returning it with `ViewModel` explicitly.
export interface ViewModel extends Instance<ViewStateModel> {}

// The engine reaches an embedder through two generic MST boundaries — the root
// model's session type and the session's view prop — and either one failing to
// infer resolves to `any` rather than to an error. That costs nothing at build
// time and everything at every call site: `viewState.session.view` is what a
// host drives, and as `any` it accepts a misspelled method silently. An earlier
// attempt at a parameterized session factory did exactly this and was green on
// tsc, jest and lint. See AssertNotAny.
export type _SessionIsTyped = AssertNotAny<IsAny<ViewModel['session']>>
export type _ViewIsTyped = AssertNotAny<IsAny<ViewModel['session']['view']>>
