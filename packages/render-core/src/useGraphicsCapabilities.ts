import { useEffect, useState } from 'react'

import { getGraphicsCapabilities } from './graphicsCapabilities.ts'

import type { GraphicsCapabilities } from './graphicsCapabilities.ts'

/**
 * The memoized capability probe, as React state — `null` until it resolves,
 * which is one microtask on a machine with no WebGPU and one adapter request on
 * one that has it.
 *
 * Hand-rolled rather than `@jbrowse/core`'s `useFetch`, and that is forced
 * rather than preferred: render-core must not depend on core (ADR-030 keeps it
 * a leaf so a third-party display can bundle it), so every hook here is its own
 * — `useRenderingBackend` and `useTabVisibilityRerender` are the same shape.
 *
 * It is also all this needs. `useFetch` carries keys, stop tokens, error state
 * and `mutate` for sources that change; capabilities are fixed for the life of
 * the page and already memoized in the module, so there is one value, fetched
 * once, that never invalidates. The effect exists only to deliver it.
 */
export function useGraphicsCapabilities() {
  const [capabilities, setCapabilities] = useState<GraphicsCapabilities | null>(
    null,
  )
  useEffect(() => {
    let live = true
    getGraphicsCapabilities().then(
      c => {
        if (live) {
          setCapabilities(c)
        }
      },
      // Both probes swallow their own failures, so this settles only if one
      // throws outside them. Staying null then is the right answer — every
      // consumer already renders the no-capabilities case — and the memo would
      // hold the rejection for the rest of the page either way, so retrying
      // here would buy nothing.
      () => {},
    )
    return () => {
      live = false
    }
  }, [])
  return capabilities
}
