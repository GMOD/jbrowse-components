import { serializedToTree } from './mapping.ts'

import type { LeafSnapshot, NodeSnapshot } from './layoutTree.ts'
import type { SerializedDockview } from 'dockview-react'

/**
 * The pre-tree layout fields that older persisted sessions carry. Both were
 * written together, so `dockviewLayout` is the usual migration source;
 * `panelViewAssignments` alone is a degraded fallback.
 */
export interface OldLayoutSnapshot {
  dockviewLayout?: SerializedDockview
  panelViewAssignments?: Record<string, string[]>
}

function leafFromAssignments(assignments: Map<string, string[]>): LeafSnapshot {
  const panels = [...assignments].map(([id, viewIds]) => ({ id, viewIds }))
  return {
    type: 'leaf',
    id: 'migrated-group',
    panels,
    ...(panels[0] === undefined ? {} : { activePanelId: panels[0].id }),
  }
}

/**
 * Convert an old session's layout fields into a layout tree snapshot, or
 * undefined when there is nothing to migrate. Uses `serializedToTree` so the
 * grid geometry survives; `panelViewAssignments` supplies the view stacks.
 */
export function migrateOldLayout(
  old: OldLayoutSnapshot,
): NodeSnapshot | undefined {
  const assignments = new Map(Object.entries(old.panelViewAssignments ?? {}))
  if (old.dockviewLayout) {
    return serializedToTree(old.dockviewLayout, assignments)
  }
  if (assignments.size > 0) {
    return leafFromAssignments(assignments)
  }
  return undefined
}
