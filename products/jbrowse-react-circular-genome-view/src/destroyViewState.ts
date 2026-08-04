import { destroy, isAlive } from '@jbrowse/mobx-state-tree'

import type { ViewModel } from './createModel/createModel.ts'

/**
 * Tear down an engine built by {@link createViewState}: terminate its RPC
 * worker threads and destroy the MST tree so its `addDisposer`'d autoruns stop.
 *
 * Unmounting the React tree is not enough — the engine is not owned by React.
 * A host that builds and discards engines (a Jupyter cell re-run, an SPA route
 * change, swapping assemblies by rebuilding) otherwise orphans a whole worker
 * pool and a live autorun set per discarded engine. A component that owns one
 * engine for the lifetime of the page never needs this.
 *
 * Idempotent: destroying an already-destroyed engine is a no-op.
 */
export function destroyViewState(viewState: ViewModel) {
  if (isAlive(viewState)) {
    // Materialize the session before killing the tree. MST snapshots each dying
    // node on the way down, and snapshotting a node that was never observed
    // instantiates it right then — running its afterAttach during death
    // finalization, where creating a further observable (the config it reads)
    // throws "the creation of the observable instance must be done on the
    // initializing phase". Reachable whenever an engine is destroyed before it
    // ever rendered, which is exactly what React StrictMode does to the
    // build-in-a-ref-callback pattern: mount, clean up, mount again.
    void viewState.session
    viewState.rpcManager.destroy()
    destroy(viewState)
  }
}
