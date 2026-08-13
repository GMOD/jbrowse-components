import type { SessionLoaderModel } from '../SessionLoader.ts'

// Tears down the build autorun and the rootModel on host unmount. Lives in its
// own module so jest tests can mock it — destroying the rootModel during test
// teardown races with pending async work and surfaces noisy errors.
//
// The loader itself is left alive, superseded or not. deactivate() releases
// everything that holds it open (the build autorun, the rootModel) and React
// drops its state reference on a swap, so it is ordinary garbage. Destroying it
// bought nothing and cost a use-after-free: a plugin can legitimately issue
// reloadPluginManagerCallback more than once off one rootModel, and the late
// call then rebuilt a replacement out of a freed node — getSnapshot() and
// setSuperseded() on a dead SessionLoader, which MST reports only as a
// liveliness warning, so it went ahead and swapped in a loader built from a
// corpse. Declining that second request is useLoaderLifecycle's job.
export function disposeLoader(loader: SessionLoaderModel) {
  loader.deactivate()
}
