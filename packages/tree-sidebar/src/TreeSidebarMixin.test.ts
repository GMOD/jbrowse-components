import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { TreeSidebarMixin } from './TreeSidebarMixin.ts'
import { treeSidebarConfigSchemaFields } from './treeSidebarConfigSchemaFields.ts'

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

describe('clearLayout', () => {
  it('drops the subtree filter along with the tree it names leaves of', () => {
    const m = makeModel()
    m.setLayoutAndClusterTree([a, b, c], '((a,b),c);')
    m.setSubtreeFilter(['a', 'b'])
    m.clearLayout()
    expect(m.layout).toEqual([])
    expect(m.clusterTree).toBeUndefined()
    expect(m.subtreeFilter).toBeUndefined()
  })
})

// Provenance labels a dendrogram with the locus it came from, so the invariant
// that matters is not that it is present but that it is never *wrong*: it may
// only ever describe the tree currently loaded. Every path that touches
// `clusterTree` therefore has to set or clear it in the same action.
describe('clusterProvenance', () => {
  const here = {
    regions: [{ refName: 'ctgA', start: 0, end: 100 }],
  }

  it('is stored with the tree it describes', () => {
    const m = makeModel()
    m.setLayoutAndClusterTree([a, b], '(a,b);', here)
    expect(m.clusterProvenance).toEqual(here)
  })

  it('is cleared whenever a reorder clears the tree', () => {
    const m = makeModel()
    m.setLayoutAndClusterTree([a, b], '(a,b);', here)
    m.setLayout([b, a])
    expect(m.clusterTree).toBeUndefined()
    expect(m.clusterProvenance).toBeUndefined()
  })

  it('survives a layout write that keeps the tree', () => {
    const m = makeModel()
    m.setLayoutAndClusterTree([a, b], '(a,b);', here)
    m.setLayout([{ name: 'a' }, { name: 'b' }])
    expect(m.clusterProvenance).toEqual(here)
  })

  it('is cleared by clearLayout', () => {
    const m = makeModel()
    m.setLayoutAndClusterTree([a, b], '(a,b);', here)
    m.clearLayout()
    expect(m.clusterProvenance).toBeUndefined()
  })

  // A tree that arrives as data (maf's `.nh` phylogeny) has no locus. Leaving
  // the previous run's provenance attached would caption a phylogeny with a
  // clustering run's region — worse than saying nothing.
  it('is cleared when a tree is supplied rather than computed', () => {
    const m = makeModel()
    m.setLayoutAndClusterTree([a, b], '(a,b);', here)
    m.setClusterTree('(b,a);')
    expect(m.clusterTree).toBe('(b,a);')
    expect(m.clusterProvenance).toBeUndefined()
  })

  // A re-run over a different locus must replace, not merge.
  it('is replaced by the next run rather than kept', () => {
    const m = makeModel()
    m.setLayoutAndClusterTree([a, b], '(a,b);', here)
    const elsewhere = {
      regions: [{ refName: 'ctgB', start: 900, end: 1000 }],
    }
    m.setLayoutAndClusterTree([b, a], '(b,a);', elsewhere)
    expect(m.clusterProvenance).toEqual(elsewhere)
  })

  it('is undefined for a run that supplies none', () => {
    const m = makeModel()
    m.setLayoutAndClusterTree([a, b], '(a,b);')
    expect(m.clusterProvenance).toBeUndefined()
  })
})

// The three toggles the mixin owns, against the slot set it owns them for.
// Composing `treeSidebarConfigSchemaFields` here is half the point: accessors and
// slots are one contract, and a display gets both or neither.
//
// Each case flips ONE slot off a true default and asserts only that toggle
// moved. Cross-wiring is the failure this is shaped for — the three bodies are
// character-identical but for the slot name, so a copy-paste reads correctly and
// answers for the wrong setting. The config half of this same set had already
// drifted once (see treeSidebarConfigSchemaFields), and inverting
// `showBranchLength` left all 3,698 tests across the four composing plugins
// green.
describe('the tree toggles', () => {
  const configSchema = ConfigurationSchema('TestTreeDisplay', {
    ...treeSidebarConfigSchemaFields({
      tree: 'show the tree',
      rowLabels: 'draw each row name',
    }),
  })

  function makeConfigured(configuration: Record<string, boolean> = {}) {
    return types
      .compose(
        'TestTreeSidebarConfigured',
        TreeSidebarMixin<Src>(),
        types.model({
          type: types.literal('TestTreeDisplay'),
          configuration: configSchema,
        }),
      )
      .create({ type: 'TestTreeDisplay', configuration })
  }

  const toggles = [
    ['showTree', 'setShowTree'],
    ['showBranchLength', 'setShowBranchLength'],
    ['showRowLabels', 'setShowRowLabels'],
  ] as const

  const others = (slot: string) => toggles.filter(([n]) => n !== slot)

  it.each(toggles)('%s defaults on and reads its own slot', slot => {
    expect(makeConfigured()[slot]).toBe(true)
    const off = makeConfigured({ [slot]: false })
    expect(off[slot]).toBe(false)
    for (const [other] of others(slot)) {
      expect(off[other]).toBe(true)
    }
  })

  it.each(toggles)('%s is written by its own setter', (slot, setter) => {
    const m = makeConfigured()
    m[setter](false)
    expect(m[slot]).toBe(false)
    for (const [other] of others(slot)) {
      expect(m[other]).toBe(true)
    }
  })
})
