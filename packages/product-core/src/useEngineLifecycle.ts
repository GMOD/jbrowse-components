import { useFinalUnmount } from '@jbrowse/core/util/hooks'

import { destroyViewState } from './destroyViewState.ts'

import type { EmbeddedRoot } from './destroyViewState.ts'

// `useCreateOnce` is core's, and is re-exported rather than wrapped: an engine
// is only the most expensive thing StrictMode's double-invoked state
// initializer can build twice, not the only one. The faceted track selector's
// MST model hit the same trap in a plugin, which cannot reach this package.
export { useCreateOnce } from '@jbrowse/core/util/hooks'

/**
 * Destroy an engine when its component really unmounts — terminating its RPC
 * worker threads and stopping its autoruns.
 *
 * The lifecycle rule is {@link useFinalUnmount}'s, including why the obvious
 * `useEffect(() => () => destroyViewState(state), [state])` is wrong under
 * StrictMode; this only names what gets torn down. Pair it with
 * `useCreateOnce`, since the engine has to be the same one for the component's
 * whole life.
 */
export function useDestroyOnUnmount(viewState: EmbeddedRoot) {
  useFinalUnmount(() => {
    destroyViewState(viewState)
  })
}
