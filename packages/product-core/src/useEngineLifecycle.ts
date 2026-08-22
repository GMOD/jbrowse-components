import { useRef } from 'react'

import { useCreateOnceAsync, useFinalUnmount } from '@jbrowse/core/util/hooks'

import { destroyViewState } from './destroyViewState.ts'

import type { EmbeddedRoot } from './destroyViewState.ts'

// `useCreateOnce` is core's, and is re-exported rather than wrapped: an engine
// is only the most expensive thing StrictMode's double-invoked state
// initializer can build twice, not the only one. The faceted track selector's
// MST model hit the same trap in a plugin, which cannot reach this package.
export { useCreateOnce, useCreateOnceAsync } from '@jbrowse/core/util/hooks'

/**
 * Build an engine asynchronously for a component's lifetime, returning
 * undefined until it is ready, and destroy it when the component really
 * unmounts. The async face of `useCreateOnce` + `useDestroyOnUnmount`, for a
 * `createViewState` that awaits lazily loaded state models.
 *
 * The build can outlive the component: an engine resolving after the final
 * unmount is destroyed on arrival instead of orphaning its worker pool and
 * autoruns.
 */
export function useAsyncEngineLifecycle<T extends EmbeddedRoot>(
  create: () => Promise<T>,
): T | undefined {
  const unmounted = useRef(false)
  const engine = useCreateOnceAsync(() =>
    create().then(built => {
      if (unmounted.current) {
        destroyViewState(built)
      }
      return built
    }),
  )
  useFinalUnmount(() => {
    unmounted.current = true
    if (engine) {
      destroyViewState(engine)
    }
  })
  return engine
}

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
