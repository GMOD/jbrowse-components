import { lazy } from 'react'

import type { AnyReactComponentType } from './types/util.ts'

/**
 * `React.lazy` that also exposes the import it wraps, so code that knows a
 * component is about to render (a session naming a view, a track being shown)
 * can start the download instead of waiting for React to reach it. A failed
 * load is not kept, so the render that follows tries again.
 *
 * Once the import has landed, the first render gets the module synchronously.
 * React.lazy suspends on any promise, settled or not, and React holds a
 * suspended boundary's reveal for 300 ms after its fallback commits, so a
 * preloaded component nested under another cost that 300 ms per level.
 */
export function lazyWithPreload<T extends AnyReactComponentType>(
  factory: () => Promise<{ default: T }>,
) {
  let loaded: { default: T } | undefined
  let loading: Promise<{ default: T }> | undefined
  const load = () =>
    (loading ??= factory().then(
      module => (loaded = module),
      (error: unknown) => {
        loading = undefined
        throw error
      },
    ))
  const settled = (module: { default: T }) =>
    ({
      // eslint-disable-next-line unicorn/no-thenable -- React.lazy takes a module synchronously only from a then that calls back at once
      then: (resolve: (m: { default: T }) => void) => {
        resolve(module)
      },
    }) as Promise<{ default: T }>
  return Object.assign(
    lazy(() => (loaded ? settled(loaded) : load())),
    { preload: load },
  )
}
