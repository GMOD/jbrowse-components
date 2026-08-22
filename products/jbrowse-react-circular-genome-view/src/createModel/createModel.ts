import PluginManager from '@jbrowse/core/PluginManager'
import { createEmbeddedRootModel } from '@jbrowse/embedded-core'
import { toPluginLoadRecord } from '@jbrowse/product-core'

import corePlugins from '../corePlugins.ts'
import { version } from '../version.ts'
import createSessionModel from './createSessionModel.ts'

import type { IsAny } from '@jbrowse/core/util/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { AssertNotAny, PluginInput } from '@jbrowse/product-core'

/**
 * #stateModel JBrowseReactCircularGenomeViewRootModel
 * #internal thin product wrapper that declares no members of its own — the
 * documented surface is EmbeddedRootModel, so this gets no website page
 * #category root
 * Composes the shared {@link EmbeddedRootModel} with a CircularView session.
 */
export default async function createModel(
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
  // the session model embeds CircularView's lazily registered state model as
  // its `view` prop, so resolve it before the factory reads it
  await pluginManager.getViewType('CircularView').loadStateModel()
  const model = createEmbeddedRootModel({
    name: 'ReactCircularGenomeView',
    version,
    pluginManager,
    sessionModelType: createSessionModel(pluginManager),
    makeWorkerInstance,
  })
  return { model, pluginManager }
}

type ViewStateModel = Awaited<ReturnType<typeof createModel>>['model']
// `interface … extends`, not `type … =`, for the same build reason as the LGV
// product's: as an alias the declaration emitter inlines the whole root-model
// type at every use, and the two entry points below then fail `build:esm` with
// TS7056. This root model is smaller and had not reached that limit yet — one
// more plugin and it would have, as a failure looking like it came from
// somewhere else. Annotate anything returning it with `ViewModel` explicitly.
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
