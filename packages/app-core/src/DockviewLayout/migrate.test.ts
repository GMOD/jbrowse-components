import { treeToSerialized, viewIdMapFromTree } from './mapping.ts'
import { migrateOldLayout } from './migrate.ts'

import type { NodeSnapshot } from './layoutTree.ts'

describe('migrateOldLayout', () => {
  it('converts a dockviewLayout blob + assignments into a tree', () => {
    const tree: NodeSnapshot = {
      type: 'branch',
      direction: 'row',
      children: [
        { type: 'leaf', id: 'g1', size: 400, panels: [{ id: 'p1', viewIds: [] }] },
        { type: 'leaf', id: 'g2', size: 600, panels: [{ id: 'p2', viewIds: [] }] },
      ],
    }
    // dockview blob carries no view ids; assignments supply the stacks
    const dockviewLayout = treeToSerialized(tree, { width: 1000, height: 800 })
    const migrated = migrateOldLayout({
      dockviewLayout,
      panelViewAssignments: { p1: ['v1'], p2: ['v2', 'v3'] },
    })

    expect(migrated && viewIdMapFromTree(migrated).get('p1')).toEqual(['v1'])
    expect(migrated && viewIdMapFromTree(migrated).get('p2')).toEqual(['v2', 'v3'])
  })

  it('falls back to a single tab group from assignments alone', () => {
    const migrated = migrateOldLayout({
      panelViewAssignments: { p1: ['v1'], p2: ['v2'] },
    })

    expect(migrated?.type).toBe('leaf')
    if (migrated?.type === 'leaf') {
      expect(migrated.panels.map(p => p.id)).toEqual(['p1', 'p2'])
      expect(migrated.activePanelId).toBe('p1')
    }
  })

  it('returns undefined when there is nothing to migrate', () => {
    expect(migrateOldLayout({})).toBeUndefined()
    expect(migrateOldLayout({ panelViewAssignments: {} })).toBeUndefined()
  })
})
