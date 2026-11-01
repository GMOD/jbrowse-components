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
 * Builds an engine once per mount and destroys it on the final unmount
 * (`useFinalUnmount`, which says why a bare effect cleanup is wrong under
 * StrictMode). Undefined until the engine is ready; one resolving after the
 * final unmount is destroyed on arrival instead of orphaning its worker pool
 * and autoruns.
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
