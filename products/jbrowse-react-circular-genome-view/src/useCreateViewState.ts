import { useAsyncEngineLifecycle } from '@jbrowse/product-core'

import createViewState from './createViewState.ts'

import type { ViewModel } from './createModel/createModel.ts'
import type { ViewStateOptions } from './createViewState.ts'

/**
 * Build an engine for a component's lifetime and hand back the model — the hook
 * form of `createViewState`, so a component doesn't have to remember to keep it
 * out of the render body (calling it there rebuilds the whole engine on every
 * render).
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
 */
export function useCreateViewState(
  opts: ViewStateOptions,
): ViewModel | undefined {
  // undefined until the engine's lazily loaded state models resolve — render a
  // fallback (or nothing) for that frame
  return useAsyncEngineLifecycle(() => createViewState(opts))
}
