import { useAsyncEngineLifecycle } from '@jbrowse/product-core'

import { createViewStateAsync } from './createViewState.ts'

import type { CreateViewStateOptions } from './createViewState.ts'

/**
 * Build an engine for a component's lifetime and hand back the model. For
 * components that render `<JBrowseApp viewState={...}>` themselves — driving
 * the app imperatively off the model, or composing it with their own chrome —
 * where `<JBrowse>`'s prop-shaped API doesn't fit.
 *
 * Options are read on the first render only. To swap assemblies or plugins,
 * remount via a React `key`; to swap the session, call `viewState.setSession`.
 *
 * **React owns this engine.** It is built once per mount and destroyed when the
 * component unmounts, so a host that mounts and discards repeatedly — an SPA
 * route, a notebook cell re-run — no longer orphans a worker pool and an
 * autorun set per discarded app, and no longer has anything to remember to
 * call. The corollary is that the model must not be used after unmount; a host
 * that wants to outlive React should call `createViewState` itself and pair it
 * with `destroyViewState`, or use `createApp`, which owns the whole lifecycle.
 *
 * Do NOT reach for `useState(() => createViewState(opts))` plus a
 * `destroyViewState` cleanup by hand: both halves are StrictMode traps, and
 * `useCreateOnce` / `useDestroyOnUnmount` in product-core spell out why.
 */
export function useCreateViewState(opts: CreateViewStateOptions) {
  // undefined until the engine's lazily loaded view and display state models
  // resolve — render a fallback (or nothing) for that frame
  return useAsyncEngineLifecycle(() => createViewStateAsync(opts))
}
