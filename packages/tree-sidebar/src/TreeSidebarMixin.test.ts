import { types } from '@jbrowse/mobx-state-tree'

import { TreeSidebarMixin } from './TreeSidebarMixin.ts'

interface Src {
  name: string
}

function makeModel() {
  return types
    .compose('TestTreeSidebar', TreeSidebarMixin<Src>(), types.model({}))
    .create({})
}

const a = { name: 'a' }
const b = { name: 'b' }
const c = { name: 'c' }

describe('willClearTree', () => {
  it('is false with no cluster tree, whatever the reorder', () => {
    const m = makeModel()
    m.setLayout([a, b])
    expect(m.willClearTree([b, a])).toBe(false)
  })

  it('is true when a loaded tree would be reordered', () => {
    const m = makeModel()
    m.setLayoutAndClusterTree([a, b], '(a,b);')
    expect(m.willClearTree([b, a])).toBe(true)
  })

  it('is false when the order is unchanged', () => {
    const m = makeModel()
    m.setLayoutAndClusterTree([a, b], '(a,b);')
    expect(m.willClearTree([a, b])).toBe(false)
  })

  it('is true when membership changes (different length)', () => {
    const m = makeModel()
    m.setLayoutAndClusterTree([a, b], '(a,b);')
    expect(m.willClearTree([a, b, c])).toBe(true)
  })
})

describe('setLayout', () => {
  it('clears the cluster tree on reorder', () => {
    const m = makeModel()
    m.setLayoutAndClusterTree([a, b], '(a,b);')
    m.setLayout([b, a])
    expect(m.clusterTree).toBeUndefined()
    expect(m.layout.map(s => s.name)).toEqual(['b', 'a'])
  })

  it('keeps the cluster tree when only colors change (order intact)', () => {
    const m = makeModel()
    m.setLayoutAndClusterTree([a, b], '(a,b);')
    m.setLayout([{ name: 'a' }, { name: 'b' }])
    expect(m.clusterTree).toBe('(a,b);')
  })
})
