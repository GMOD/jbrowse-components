import { destroy, isAlive } from '@jbrowse/mobx-state-tree'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * Free a tree an action has already let go of — a superseded session, a view
 * taken out of one, a superseded rootModel the React host has detached.
 *
 * A task rather than a microtask: the wait is for React to unmount the
 * components rendering it, which happens on the re-render that the action's own
 * reactions schedule. Deferring is acceptable here, and is not elsewhere,
 * because the node stays alive and detached until it fires — a late read gets a
 * live tree nobody is rendering. ADR-069.
 *
 * The destroy itself is not optional. `beforeDestroy` is a plugin-facing
 * contract (jbrowse-plugin-apollo aborts its in-flight fetches there) and core's
 * `BaseTrackModel` releases the `rpcSessionId` claim that lets
 * `CoreFreeResources` evict a parsed adapter from the worker — so detaching and
 * forgetting would trade a console warning for an unbounded leak.
 */
export function scheduleDetachedDestroy(node: IAnyStateTreeNode) {
  setTimeout(() => {
    if (isAlive(node)) {
      destroy(node)
    }
  }, 0)
}
