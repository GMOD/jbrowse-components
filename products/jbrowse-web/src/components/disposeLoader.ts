import type { SessionLoaderModel } from '../SessionLoader.ts'

// Tears down both the build autorun and the rootModel on host unmount.
// Lives in its own module so jest tests can mock it — destroying the
// rootModel during test teardown races with pending async work and surfaces
// noisy errors.
export function disposeLoader(loader: SessionLoaderModel) {
  loader.deactivate()
}
