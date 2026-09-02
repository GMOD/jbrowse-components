import { useAsyncEngineLifecycle } from '@jbrowse/product-core'

import { createViewStateAsync } from './createViewState.ts'

import type { ViewModel } from './createModel/createModel.ts'
import type { ViewStateOptions } from './createViewState.ts'

/**
 * Build an engine for a component's lifetime and hand back the model. For
 * components that render `<JBrowseLinearGenomeView viewState={...}>` themselves
 * — driving the view imperatively off the model, or composing it with their own
 * chrome — where `<LinearGenomeView>`'s prop-shaped API doesn't fit.
 *
 * Options are read on the first render only. To swap the assembly or plugins,
 * remount via a React `key`.
 *
 * **React owns this engine.** It is built once per mount and destroyed when the
 * component unmounts, so a host that mounts and discards repeatedly — an SPA
 * route, a notebook cell re-run — no longer orphans a worker pool and an
 * autorun set per discarded view, and no longer has anything to remember to
 * call. The corollary is that the model must not be used after unmount; a host
 * that wants to outlive React should call `createViewState` itself and pair it
 * with `destroyViewState`.
 *
 * Do NOT reach for `useState(() => createViewState(opts))` plus a
 * `destroyViewState` cleanup by hand: both halves are StrictMode traps, and
 * `useCreateOnce` / `useDestroyOnUnmount` in product-core spell out why.
 *
 * The lazily loaded view and display types the session names are resolved
 * first, so this returns undefined for the first frame, and the component
 * renders nothing until then.
 */
export function useCreateViewState(
  opts: ViewStateOptions,
): ViewModel | undefined {
  return useAsyncEngineLifecycle(() => createViewStateAsync(opts))
}
