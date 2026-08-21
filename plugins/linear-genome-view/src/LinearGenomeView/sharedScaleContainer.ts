import { getParent, hasParent, isAlive } from '@jbrowse/mobx-state-tree'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * A container's zoom-out ceiling for the rows it stacks. Unanswered is its own
 * state rather than a zero: a row that has not been laid out yet cannot supply
 * a fit, and reading that as "no shared ceiling" is a different claim. See
 * `LinearComparativeView/sharedFit.ts`.
 */
export type SharedFit =
  | { answered: false }
  | { answered: true; bpPerPx: number }

// Duck-typed: the comparative views depend on this plugin, so importing them
// back would be circular.
export interface SharedScaleContainer {
  sharedFit: SharedFit
}

export function isSharedScaleContainer(
  thing: unknown,
): thing is SharedScaleContainer {
  return typeof thing === 'object' && thing !== null && 'sharedFit' in thing
}

// Walks rather than using findParentThatIs because having no such container is
// the ordinary standalone case here, not the error that helper reports.
export function sharedScaleContainerOf(node: IAnyStateTreeNode) {
  let current = node
  let found: SharedScaleContainer | undefined
  while (!found && hasParent(current) && isAlive(current)) {
    current = getParent<IAnyStateTreeNode>(current)
    if (isSharedScaleContainer(current)) {
      found = current
    }
  }
  return found
}
