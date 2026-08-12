import { destroy } from '@jbrowse/mobx-state-tree'

import type { SessionLoaderModel } from '../SessionLoader.ts'

// Tears down both the build autorun and the rootModel on host unmount.
// Lives in its own module so jest tests can mock it — destroying the
// rootModel during test teardown races with pending async work and surfaces
// noisy errors.
//
// A superseded loader (a plugin reload already built its replacement) is also
// destroyed: it can never be re-activated, and each one otherwise leaks a full
// frozen config + session snapshot for the life of the tab. Every other
// detach — StrictMode's double-invoked effect, a Fast Refresh remount — leaves
// the loader alive so the same instance can be re-activated with the session
// deactivate() just saved into sessionSource.
export function disposeLoader(loader: SessionLoaderModel) {
  loader.deactivate()
  if (loader.superseded) {
    // Deferred a tick: this cleanup runs inside React's passive-effect
    // flush, synchronously followed — same flush, same call stack — by its
    // dev-mode component-render logging, which reads `loader` again as
    // Renderer's/SessionTriaged's "previous props". Destroying synchronously
    // here made every property on it (configPath, sessionQuery, ...) log a
    // "you are trying to read or write to an object that is no longer part
    // of a state tree" MST warning. A microtask runs only once that
    // synchronous flush has fully unwound, so this still frees the node
    // well before the next paint, just after the dev-mode read that would
    // otherwise hit a dead one.
    queueMicrotask(() => {
      destroy(loader)
    })
  }
}
