import {
  ConfigurationSchema,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { TreeSidebarMixin } from './TreeSidebarMixin.ts'
import { getLeafNames } from './clusterUtils.ts'
import {
  rowDomainConfigSchemaFields,
  treeSidebarConfigSchemaFields,
} from './treeSidebarConfigSchemaFields.ts'

import type { TreeSidebarHost } from './TreeSidebarMixin.ts'
import type { HostChecksSlotNames } from '@jbrowse/core/configuration'

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

describe('the row arrangement', () => {
  it('answers the tree, its provenance and the focus it was given', () => {
    const m = makeModel()
    const run = {
      tree: '(a,b);',
      provenance: { regions: [], settings: [] },
    }
    m.setRowOrder([a, b], run)
    m.setRowFocus(['a'])
    expect(m.rowTree).toBe(run.tree)
    expect(m.rowTreeProvenance).toEqual(run.provenance)
    expect(m.rowFocus).toEqual(['a'])
    expect(m.rowArrangementIsCustom).toBe(true)
  })

  it('drops the tree when the dialog reorders the rows', () => {
    const m = makeModel()
    m.setRowOrder([a, b], { tree: '(a,b);' })
    m.applyRowEdits([b, a])
    expect(m.rowTree).toBeUndefined()
  })

  it('resets order, tree and focus together', () => {
    const m = makeModel()
    m.setRowOrder([a, b], { tree: '(a,b);' })
    m.setRowFocus(['a'])
    m.resetRowArrangement()
    expect(m.rowTree).toBeUndefined()
    expect(m.rowFocus).toBeUndefined()
    expect(m.rowArrangementIsCustom).toBe(false)
  })
})

describe('rowOrderWillDropTree', () => {
  it('is false with no cluster tree, whatever the reorder', () => {
    const m = makeModel()
    m.setRowOrder([a, b])
    expect(m.rowOrderWillDropTree([b, a])).toBe(false)
  })

  it('is true when a loaded tree would be reordered', () => {
    const m = makeModel()
    m.setRowOrder([a, b], { tree: '(a,b);' })
    expect(m.rowOrderWillDropTree([b, a])).toBe(true)
  })

  it('is false when the order is unchanged', () => {
    const m = makeModel()
    m.setRowOrder([a, b], { tree: '(a,b);' })
    expect(m.rowOrderWillDropTree([a, b])).toBe(false)
  })

  it('is true when membership changes (different length)', () => {
    const m = makeModel()
    m.setRowOrder([a, b], { tree: '(a,b);' })
    expect(m.rowOrderWillDropTree([a, b, c])).toBe(true)
  })
})

describe('setRowOrder', () => {
  it('clears the cluster tree on reorder', () => {
    const m = makeModel()
    m.setRowOrder([a, b], { tree: '(a,b);' })
    m.setRowOrder([b, a])
    expect(m.clusterTree).toBeUndefined()
    expect(m.layout.map(s => s.name)).toEqual(['b', 'a'])
  })

  it('keeps the cluster tree when only colors change (order intact)', () => {
    const m = makeModel()
    m.setRowOrder([a, b], { tree: '(a,b);' })
    m.setRowOrder([{ name: 'a' }, { name: 'b' }])
    expect(m.clusterTree).toBe('(a,b);')
  })
})

describe('resetRowArrangement', () => {
  it('drops the subtree filter along with the tree it names leaves of', () => {
    const m = makeModel()
    m.setRowOrder([a, b, c], { tree: '((a,b),c);' })
    m.setRowFocus(['a', 'b'])
    m.resetRowArrangement()
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
    m.setRowOrder([a, b], { tree: '(a,b);', provenance: here })
    expect(m.clusterProvenance).toEqual(here)
  })

  it('is cleared whenever a reorder clears the tree', () => {
    const m = makeModel()
    m.setRowOrder([a, b], { tree: '(a,b);', provenance: here })
    m.setRowOrder([b, a])
    expect(m.clusterTree).toBeUndefined()
    expect(m.clusterProvenance).toBeUndefined()
  })

  it('survives a layout write that keeps the tree', () => {
    const m = makeModel()
    m.setRowOrder([a, b], { tree: '(a,b);', provenance: here })
    m.setRowOrder([{ name: 'a' }, { name: 'b' }])
    expect(m.clusterProvenance).toEqual(here)
  })

  it('is cleared by resetRowArrangement', () => {
    const m = makeModel()
    m.setRowOrder([a, b], { tree: '(a,b);', provenance: here })
    m.resetRowArrangement()
    expect(m.clusterProvenance).toBeUndefined()
  })

  // A tree that arrives as data (maf's `.nh` phylogeny) has no locus. Leaving
  // the previous run's provenance attached would caption a phylogeny with a
  // clustering run's region — worse than saying nothing.
  it('is cleared when a tree is supplied rather than computed', () => {
    const m = makeModel()
    m.setRowOrder([a, b], { tree: '(a,b);', provenance: here })
    m.setClusterTree('(b,a);')
    expect(m.clusterTree).toBe('(b,a);')
    expect(m.clusterProvenance).toBeUndefined()
  })

  // A re-run over a different locus must replace, not merge.
  it('is replaced by the next run rather than kept', () => {
    const m = makeModel()
    m.setRowOrder([a, b], { tree: '(a,b);', provenance: here })
    const elsewhere = {
      regions: [{ refName: 'ctgB', start: 900, end: 1000 }],
    }
    m.setRowOrder([b, a], { tree: '(b,a);', provenance: elsewhere })
    expect(m.clusterProvenance).toEqual(elsewhere)
  })

  it('is undefined for a run that supplies none', () => {
    const m = makeModel()
    m.setRowOrder([a, b], { tree: '(a,b);' })
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
    ...rowDomainConfigSchemaFields({
      rows: 'row order; the rows listed come first, in this order',
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

// The fourth slot, and the one with no setter: `layout` is the runtime row
// order and this is only the seed under it.
describe('the row domain', () => {
  const configSchema = ConfigurationSchema('TestDomainDisplay', {
    ...treeSidebarConfigSchemaFields({
      tree: 'show the tree',
      rowLabels: 'draw each row name',
    }),
    ...rowDomainConfigSchemaFields({
      rows: 'row order; the rows listed come first, in this order',
    }),
  })

  function makeConfigured(configuration: Record<string, unknown> = {}) {
    return types
      .compose(
        'TestRowDomainConfigured',
        TreeSidebarMixin<Src>(),
        types.model({
          type: types.literal('TestDomainDisplay'),
          configuration: configSchema,
        }),
      )
      .create({ type: 'TestDomainDisplay', configuration })
  }

  it('defaults to no declared order', () => {
    expect(makeConfigured().rowDomain).toEqual([])
  })

  it('reads the `domain` slot', () => {
    expect(makeConfigured({ domain: ['b', 'a'] }).rowDomain).toEqual(['b', 'a'])
  })

  const leafNames = (m: { parsedTree?: Parameters<typeof getLeafNames>[0] }) =>
    m.parsedTree && getLeafNames(m.parsedTree)

  it('rotates a supplied tree towards it', () => {
    const m = makeConfigured({ domain: ['c'] })
    m.setClusterTree('((a,b),(c,d));')
    expect(leafNames(m)).toEqual(['c', 'd', 'a', 'b'])
  })

  // A computed tree was rotated by the run that produced it, together with the
  // `layout` written in the same action. Rotating it again on the way out would
  // turn a session saved under one domain and reopened under another away from
  // its own rows, and `treeDescribesRows` would then draw nothing at all.
  it('leaves a computed tree as the run stored it', () => {
    const m = makeConfigured({ domain: ['c'] })
    m.setRowOrder([], {
      tree: '((a,b),(c,d));',
      provenance: {
        regions: [],
        settings: [],
      },
    })
    expect(leafNames(m)).toEqual(['a', 'b', 'c', 'd'])
  })
})

// The opt-out: a display whose row order is declared elsewhere (the wiggle
// display's is `facet.domain`) passes no `rows` sentence and owes a `rowDomain`
// getter of its own. Reading the mixin's one is the failure this refuses to let
// pass as an empty order, which would silently drop the declared order and take
// adapter order instead.
describe('a display declaring no `domain` slot', () => {
  const configSchema = ConfigurationSchema('TestOptOutDisplay', {
    ...treeSidebarConfigSchemaFields({
      tree: 'show the tree',
      rowLabels: 'draw each row name',
    }),
  })

  function makeOptedOut() {
    return types
      .compose(
        'TestRowDomainOptOut',
        TreeSidebarMixin<Src>(),
        types.model({
          type: types.literal('TestOptOutDisplay'),
          configuration: configSchema,
        }),
      )
      .create({ type: 'TestOptOutDisplay', configuration: {} })
  }

  it('declares no `domain` slot', () => {
    expect('domain' in makeOptedOut().configuration).toBe(false)
  })

  it('throws from `rowDomain` rather than reading an empty order', () => {
    expect(() => makeOptedOut().rowDomain).toThrow(/rowDomain/)
  })

  it('takes an override of its own', () => {
    const m = types
      .compose(
        'TestRowDomainOverride',
        TreeSidebarMixin<Src>(),
        types.model({
          type: types.literal('TestOptOutDisplay'),
          configuration: configSchema,
        }),
      )
      .views(() => ({
        get rowDomain() {
          return ['b', 'a']
        },
      }))
      .create({ type: 'TestOptOutDisplay', configuration: {} })
    expect(m.rowDomain).toEqual(['b', 'a'])
  })
})

// Typecheck-only, the way `extensionPoints.test.ts` asserts its guarantee: an
// unused @ts-expect-error fails `pnpm typecheck`. It asks `TreeSidebarHost`
// rather than a composed model on purpose — a test model's own schema is
// concrete and checks the name itself, so asking that passes whatever the mixin
// casts to. Widen the host back to `AnyConfigurationModel` and the three toggle
// names above stop being checked, with a misspelled read reporting nothing at
// any layer.
// The type-level half, greppable across every mixin: `HostChecksSlotNames`
// resolves to `false` the moment the cast widens.
const treeSidebarPin: HostChecksSlotNames<TreeSidebarHost> = true

test('the host type checks the slot names the mixin reads through it', () => {
  expect(treeSidebarPin).toBe(true)
  const host = {} as TreeSidebarHost
  const read = () => {
    // @ts-expect-error
    return getConf(host, 'showTrea')
  }
  const write = () => {
    // @ts-expect-error
    setConf(host, 'showTrea', true)
  }
  expect([read, write]).toHaveLength(2)
})
