import { destroy, isAlive } from '@jbrowse/mobx-state-tree'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * Free a session that `setSession` has already detached.
 *
 * A task rather than a microtask: the wait is for React to unmount the
 * components rendering it, which happens on the re-render that this action's
 * own reactions schedule. Deferring is acceptable here, and is not elsewhere,
 * because the node stays alive and detached until it fires — a late read gets
 * a live tree nobody is rendering. ADR-069.
 */
export function scheduleSessionDestroy(session: IAnyStateTreeNode) {
  setTimeout(() => {
    if (isAlive(session)) {
      destroy(session)
    }
  }, 0)
}
