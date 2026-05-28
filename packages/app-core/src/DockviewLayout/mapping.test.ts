import {
  serializedToTree,
  treeToSerialized,
  viewIdMapFromTree,
} from './mapping.ts'

import type { NodeSnapshot } from './layoutTree.ts'

// Branch directions must alternate by depth (a dockview grid invariant), since
// dockview only stores the root orientation and derives the rest from depth.
const tree: NodeSnapshot = {
  type: 'branch',
  direction: 'row',
  children: [
    {
      type: 'leaf',
      id: 'g1',
      size: 300,
      activePanelId: 'p1',
      panels: [{ id: 'p1', viewIds: ['v1', 'v2'], title: 'A' }],
    },
    {
      type: 'branch',
      direction: 'column',
      size: 700,
      children: [
        { type: 'leaf', id: 'g2', size: 200, panels: [{ id: 'p2', viewIds: ['v3'] }] },
        {
          type: 'leaf',
          id: 'g3',
          size: 500,
          activePanelId: 'p4',
          panels: [
            { id: 'p3', viewIds: ['v4'], title: 'C' },
            { id: 'p4', viewIds: [] },
          ],
        },
      ],
    },
  ],
}

const dims = { width: 1000, height: 800 }

describe('treeToSerialized / serializedToTree', () => {
  it('round-trips a nested tree exactly', () => {
    const serialized = treeToSerialized(tree, dims, 'p1')
    const back = serializedToTree(serialized, viewIdMapFromTree(tree))
    expect(back).toEqual(tree)
  })

  it('round-trips a single-leaf root', () => {
    const leaf: NodeSnapshot = {
      type: 'leaf',
      id: 'g1',
      activePanelId: 'p1',
      panels: [{ id: 'p1', viewIds: ['v1'] }],
    }
    const back = serializedToTree(
      treeToSerialized(leaf, dims),
      viewIdMapFromTree(leaf),
    )
    expect(back).toEqual(leaf)
  })

  it('drops view ids and blanks params in the dockview blob', () => {
    const serialized = treeToSerialized(tree, dims)
    expect(serialized.panels.p1).toEqual({
      id: 'p1',
      contentComponent: 'jbrowseView',
      tabComponent: 'jbrowseTab',
      title: 'A',
      params: {},
    })
    // view ids live only in MST, never in the dockview panel state
    expect(JSON.stringify(serialized.panels)).not.toContain('v1')
  })

  it('maps direction to orientation and sets activeGroup from active panel', () => {
    const serialized = treeToSerialized(tree, dims, 'p3')
    expect(serialized.grid.orientation).toBe('HORIZONTAL')
    expect(serialized.activeGroup).toBe('g3')
  })

  it('re-attaches view stacks from the previous map across a geometry-only change', () => {
    const serialized = treeToSerialized(tree, dims)
    const map = viewIdMapFromTree(tree)
    const back = serializedToTree(serialized, map)
    expect(viewIdMapFromTree(back).get('p1')).toEqual(['v1', 'v2'])
  })
})
