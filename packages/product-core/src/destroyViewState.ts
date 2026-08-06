import { destroy, isAlive } from '@jbrowse/mobx-state-tree'

import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

// Duck-typed rather than importing a product's ViewModel: product-core cannot
// name one, and every embedded root has these two members. `IStateTreeNode`
// (not `IAnyStateTreeNode`, which resolves to `any` and would switch off the
// checking below) keeps it assignable to isAlive/destroy while staying checked.
interface EmbeddedRoot extends IStateTreeNode {
  session?: unknown
  rpcManager: { destroy: () => void }
}

/**
 * Tear down an engine built by an embedded product's `createViewState`:
 * terminate its RPC worker threads and destroy the MST tree so its
 * `addDisposer`'d autoruns stop.
 *
 * Unmounting the React tree is not enough — the engine is not owned by React.
 * A host that builds and discards engines (a Jupyter cell re-run, an SPA route
 * change, a controller's `destroy()`) otherwise orphans a whole worker pool and
 * a live autorun set per discarded engine. A component that owns one engine for
 * the lifetime of the page never needs this.
 *
 * Idempotent: destroying an already-destroyed engine is a no-op.
 */
export function destroyViewState(viewState: EmbeddedRoot) {
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
