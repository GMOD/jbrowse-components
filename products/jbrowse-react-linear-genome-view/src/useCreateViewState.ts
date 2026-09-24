import { useAsyncEngineLifecycle } from '@jbrowse/product-core'

import { createViewStateAsync } from './createViewState.ts'

import type { ViewModel } from './createModel/createModel.ts'
import type { AsyncViewStateOptions } from './createViewState.ts'

/**
 * Build an engine for a component's lifetime and hand back the model. For
 * components that render `<JBrowseLinearGenomeView viewState={...}>` themselves
 * — driving the view imperatively off the model, or composing it with their own
 * chrome — where `<LinearGenomeView>`'s prop-shaped API doesn't fit.
 *
 * Pass a function returning the engine instead of options when building takes
 * more than one call: plugins fetched with `loadPlugins` first, or a fallback
 * for a restored session that will not load. It runs once per mount.
 *
 * Options are read on the first render only. To swap the assembly or plugins,
 * remount via a React `key`.
 *
 * **React owns this engine.** It is built once per mount and destroyed when the
 * component unmounts, including one that finishes building after the unmount.
 * The model must not be used after unmount; a host that wants to outlive React
 * should call `createViewState` itself and pair it with `destroyViewState`.
 *
 * Undefined until the engine is built, so the first frame renders nothing. A
 * build that throws rethrows from render, for an error boundary to catch.
 */
export function useCreateViewState(
  opts: AsyncViewStateOptions | (() => Promise<ViewModel>),
): ViewModel | undefined {
  return useAsyncEngineLifecycle(() =>
    typeof opts === 'function' ? opts() : createViewStateAsync(opts),
  )
}
