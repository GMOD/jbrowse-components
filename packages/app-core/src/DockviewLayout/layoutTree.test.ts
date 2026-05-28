import { types } from '@jbrowse/mobx-state-tree'

import {
  LayoutNode,
  collectLeaves,
  collectPanels,
  findLeafOfPanel,
  findPanel,
  findPanelOfView,
} from './layoutTree.ts'

import type { NodeSnapshot } from './layoutTree.ts'

const Container = types.model('Container', {
  root: types.maybe(LayoutNode),
})

const snapshot: NodeSnapshot = {
  type: 'branch',
  direction: 'row',
  children: [
    {
      type: 'leaf',
      id: 'g1',
      panels: [{ id: 'p1', viewIds: ['v1', 'v2'] }],
    },
    {
      type: 'branch',
      direction: 'column',
      children: [
        { type: 'leaf', id: 'g2', panels: [{ id: 'p2', viewIds: ['v3'] }] },
        {
          type: 'leaf',
          id: 'g3',
          panels: [
            { id: 'p3', viewIds: ['v4'] },
            { id: 'p4', viewIds: [] },
          ],
        },
      ],
    },
  ],
}

function makeRoot() {
  const root = Container.create({ root: snapshot }).root
  if (!root) {
    throw new Error('no root')
  }
  return root
}

describe('layoutTree helpers', () => {
  it('collects leaves and panels depth-first', () => {
    const root = makeRoot()
    expect(collectLeaves(root).map(l => l.id)).toEqual(['g1', 'g2', 'g3'])
    expect(collectPanels(root).map(p => p.id)).toEqual(['p1', 'p2', 'p3', 'p4'])
  })

  it('finds a panel by id', () => {
    const root = makeRoot()
    expect(findPanel(root, 'p3')?.viewIds.slice()).toEqual(['v4'])
    expect(findPanel(root, 'nope')).toBeUndefined()
  })

  it('finds the leaf containing a panel', () => {
    const root = makeRoot()
    expect(findLeafOfPanel(root, 'p4')?.id).toBe('g3')
  })

  it('finds the panel whose view stack contains a view', () => {
    const root = makeRoot()
    expect(findPanelOfView(root, 'v3')?.id).toBe('p2')
    expect(findPanelOfView(root, 'missing')).toBeUndefined()
  })
})
