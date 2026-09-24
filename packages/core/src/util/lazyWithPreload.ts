import { lazy } from 'react'

import type { AnyReactComponentType } from './types/util.ts'

/**
 * `React.lazy` that also exposes the import it wraps, so code that knows a
 * component is about to render (a session naming a view, a track being shown)
 * can start the download instead of waiting for React to reach it. A failed
 * load is not kept, so the render that follows tries again.
 */
export function lazyWithPreload<T extends AnyReactComponentType>(
  factory: () => Promise<{ default: T }>,
) {
  let loading: Promise<{ default: T }> | undefined
  const load = () =>
    (loading ??= factory().catch((error: unknown) => {
      loading = undefined
      throw error
    }))
  return Object.assign(lazy(load), { preload: load })
}
