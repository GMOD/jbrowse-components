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
    destroy(loader)
  }
}
