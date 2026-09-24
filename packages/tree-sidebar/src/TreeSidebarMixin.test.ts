import {
  ConfigurationSchema,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { categoricalPalette } from '@jbrowse/core/ui/colors'
import { rowArrangementConfigSchema } from '@jbrowse/display-kit/rowArrangementConfigSchema'
import { rowColorConfigSchema } from '@jbrowse/display-kit/rowColorConfigSchema'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { TreeSidebarMixin } from './TreeSidebarMixin.ts'
import { treeSidebarConfigSchemaFields } from './treeSidebarConfigSchemaFields.ts'

import type { TreeSidebarHost } from './TreeSidebarMixin.ts'
import type { HostChecksSlotNames } from '@jbrowse/core/configuration'

// The arrangement itself is exercised through the four row displays'
// rowDerivation suites: a bare model has no track, no session and no base
// config to compare against. What this file pins is the type-level half: widen
// the host back to `AnyConfigurationModel` and every slot name below stops
// being checked, with a misspelled read reporting nothing at any layer.
const treeSidebarPin: HostChecksSlotNames<TreeSidebarHost> = true

test('the host type checks the slot names the mixin reads through it', () => {
  expect(treeSidebarPin).toBe(true)
  const host = {} as TreeSidebarHost
  const read = () => {
    // @ts-expect-error
    return getConf(host, 'showTrea')
  }
  const readMember = () => {
    // @ts-expect-error
    return getConf(host, ['rows', 'order'])
  }
  const write = () => {
    // @ts-expect-error
    setConf(host, ['rows', 'order'], [])
  }
  const readColor = () => {
    // @ts-expect-error
    return getConf(host, ['rowColour', 'domain'])
  }
  const writeColor = () => {
    // @ts-expect-error
    setConf(host, ['rowColor', 'domains'], [])
  }
  expect([read, readMember, write, readColor, writeColor]).toHaveLength(5)
})

const configSchema = ConfigurationSchema('TestTreeDisplay', {
  ...treeSidebarConfigSchemaFields({
    tree: 'show the tree',
    rowLabels: 'draw each row name',
  }),
  rows: rowArrangementConfigSchema,
  rowColor: rowColorConfigSchema,
})

function makeDisplay(configuration: Record<string, unknown> = {}) {
  return types
    .compose(
      'TestTreeDisplay',
      TreeSidebarMixin(),
      types.model({
        type: types.literal('TestTreeDisplay'),
        configuration: configSchema,
      }),
    )
    .create({ type: 'TestTreeDisplay', configuration })
}

// Each case flips ONE slot off a true default and asserts only that toggle
// moved. Cross-wiring is the failure this is shaped for — the three bodies are
// character-identical but for the slot name, so a copy-paste reads correctly and
// answers for the wrong setting. Inverting `showBranchLength` once left all
// 3,698 tests across the four composing plugins green.
describe('the tree toggles', () => {
  const toggles = [
    ['showTree', 'setShowTree'],
    ['showBranchLength', 'setShowBranchLength'],
    ['showRowLabels', 'setShowRowLabels'],
  ] as const

  const others = (slot: string) => toggles.filter(([n]) => n !== slot)

  it.each(toggles)('%s defaults on and reads its own slot', slot => {
    expect(makeDisplay()[slot]).toBe(true)
    const off = makeDisplay({ [slot]: false })
    expect(off[slot]).toBe(false)
    for (const [other] of others(slot)) {
      expect(off[other]).toBe(true)
    }
  })

  it.each(toggles)('%s is written by its own setter', (slot, setter) => {
    const m = makeDisplay()
    m[setter](false)
    expect(m[slot]).toBe(false)
    for (const [other] of others(slot)) {
      expect(m[other]).toBe(true)
    }
  })
})

// A display that overrides no hook still derives: no rows, and nothing to
// arrange.
describe('the declared hooks', () => {
  it('derive empty rows before a display supplies any', () => {
    const display = makeDisplay({ rows: { domain: ['a'] } })
    expect(display.discoveredRows).toEqual([])
    expect(display.editableSources).toEqual([])
    expect(display.clusterableSources).toEqual([])
    expect(display.identityChannel).toBe('color')
    expect(display.unlistedRowsSort).toBe('source')
    expect(display.rowOrder).toEqual(['a'])
  })
})

// A display supplies its rows the way every display supplies `autoRowHeight`:
// a getter in a later `.views` block, over state of its own.
describe('a display supplying the hooks', () => {
  function makeSupplied() {
    return types
      .compose(
        'SuppliedTreeDisplay',
        TreeSidebarMixin(),
        types.model({
          type: types.literal('SuppliedTreeDisplay'),
          configuration: configSchema,
        }),
      )
      .volatile(() => ({ names: ['a', 'b', 'c'] }))
      .views(self => ({
        get discoveredRows() {
          return self.names.map(name => ({ name }))
        },
        get identityChannel(): 'color' | 'labelColor' {
          return 'labelColor'
        },
      }))
      .create({
        type: 'SuppliedTreeDisplay',
        configuration: {
          rows: { domain: ['c'], labels: { a: 'Ay' }, kept: ['a', 'c'] },
          rowColor: { domain: ['b'], range: ['#00f'] },
        },
      })
  }

  it('derives the arranged and the focused rows from them', () => {
    const display = makeSupplied()
    expect(display.editableSources).toEqual([
      { name: 'c' },
      { name: 'a', label: 'Ay' },
      { name: 'b', labelColor: '#00f' },
    ])
    expect(display.clusterableSources.map(r => r.name)).toEqual(['c', 'a'])
  })

  it('refuses a volatile over a declared hook', () => {
    expect(() =>
      types
        .compose(
          'VolatileTreeDisplay',
          TreeSidebarMixin(),
          types.model({ configuration: configSchema }),
        )
        .volatile(() => ({ discoveredRows: [] }))
        .create({ configuration: {} }),
    ).toThrow(/computed value/)
  })
})

describe('a dialog submit after a region adds a row', () => {
  function makeGrowing() {
    return types
      .compose(
        'GrowingTreeDisplay',
        TreeSidebarMixin(),
        types.model({
          type: types.literal('GrowingTreeDisplay'),
          configuration: configSchema,
        }),
      )
      .volatile(() => ({ names: ['b', 'c'] }))
      .views(self => ({
        get discoveredRows() {
          return self.names.map(name => ({ name }))
        },
        get unlistedRowsSort(): 'source' | 'sorted' {
          return 'sorted'
        },
      }))
      .actions(self => ({
        reveal(name: string) {
          self.names = [...self.names, name]
        },
      }))
      .create({
        type: 'GrowingTreeDisplay',
        configuration: { rows: { tree: '(b:1,c:1);' } },
      })
  }

  it('reads the rows left in place as no move', () => {
    const display = makeGrowing()
    const dialog = display.editableSources
    display.reveal('a')
    expect(display.rowOrderWillDropTree(dialog)).toBe(false)
    display.applyRowEdits(dialog)
    expect(display.rowDomain).toEqual([])
    expect(display.rowTree).toBe('(b:1,c:1);')
    expect(display.editableSources.map(r => r.name)).toEqual(['a', 'b', 'c'])
  })
})

// What the flip deals every display's palette by, before any display opts in:
// the rowColor field's values over the base arrangement, the listed values
// taking their range colour.
describe('the default row palette', () => {
  function makePalette(configuration: Record<string, unknown> = {}) {
    return types
      .compose(
        'PaletteTreeDisplay',
        TreeSidebarMixin(),
        types.model({
          type: types.literal('PaletteTreeDisplay'),
          configuration: configSchema,
        }),
      )
      .volatile(() => ({
        rows: [
          { name: 'a', group: 'x' },
          { name: 'b', group: 'y' },
          { name: 'c', group: 'x' },
        ],
      }))
      .views(self => ({
        get discoveredRows() {
          return self.rows
        },
      }))
      .create({ type: 'PaletteTreeDisplay', configuration })
  }

  it('deals the unlisted rows the palette in the base arrangement', () => {
    const display = makePalette({
      rowColor: { domain: ['b'], range: ['#00f'] },
    })
    expect(Object.fromEntries(display.rowColorScale)).toEqual({
      a: categoricalPalette[0],
      b: '#00f',
      c: categoricalPalette[1],
    })
  })

  it('deals by another row attribute', () => {
    const display = makePalette({ rowColor: 'group' })
    expect(Object.fromEntries(display.rowColorScale)).toEqual({
      a: categoricalPalette[0],
      b: categoricalPalette[1],
      c: categoricalPalette[0],
    })
  })

  it('deals none under scale none', () => {
    const display = makePalette({ rowColor: { field: 'group', scale: 'none' } })
    expect(display.rowColorScale.size).toBe(0)
  })

  // Observed, as a display's paint path observes it: an unobserved computed
  // deals again on every read.
  it('keeps its identity across a reorder, a focus and a relabel', () => {
    const display = makePalette()
    const stop = autorun(() => display.rowColorScale)
    const palette = display.rowColorScale
    display.setRowOrder([{ name: 'c' }, { name: 'b' }, { name: 'a' }])
    display.setRowFocus(['a'])
    display.applyRowEdits(
      display.editableSources.map(r => ({ ...r, label: r.name.toUpperCase() })),
    )
    expect(display.rowLabels).toEqual({ a: 'A', b: 'B', c: 'C' })
    expect(display.rowColorScale).toBe(palette)
    stop()
  })

  it('offers the attributes the rows carry, and previews a setting', () => {
    const display = makePalette()
    expect(display.rowColorFields).toEqual(['group'])
    const preview = display.rowColorsFor({
      field: 'group',
      scale: undefined,
      domain: ['y'],
      range: ['#abcdef'],
    })
    expect(Object.fromEntries(preview)).toEqual({
      x: categoricalPalette[0],
      y: '#abcdef',
    })
  })
})

// The dialog shows one `rowColor` object and submits it: a row's colour is
// read only while the rows are coloured each their own.
describe('a dialog submit of the row colours', () => {
  function makeGrouped(configuration: Record<string, unknown> = {}) {
    return types
      .compose(
        'GroupedTreeDisplay',
        TreeSidebarMixin(),
        types.model({
          type: types.literal('GroupedTreeDisplay'),
          configuration: configSchema,
        }),
      )
      .volatile(() => ({
        rows: [
          { name: 'a', group: 'x' },
          { name: 'b', group: 'y' },
          { name: 'c', group: 'x' },
        ],
      }))
      .views(self => ({
        get discoveredRows() {
          return self.rows
        },
      }))
      .create({ type: 'GroupedTreeDisplay', configuration })
  }
  const recoloured = (display: ReturnType<typeof makeGrouped>) => {
    const [a, b, c] = display.editableSources
    return [a!, { ...b!, color: '#123456' }, c!]
  }

  it('reads no row colour while the rows are colored by an attribute', () => {
    const display = makeGrouped({ rowColor: 'group' })
    const before = Object.fromEntries(display.rowColorScale)
    display.applyRowEdits(recoloured(display))
    expect(display.rowColorChoice).toBe('group')
    expect(Object.fromEntries(display.rowColorScale)).toEqual(before)
  })

  it("writes an attribute's colors as the dialog shows them", () => {
    const display = makeGrouped({ rowColor: 'group' })
    display.applyRowEdits(display.editableSources, {
      field: 'group',
      domain: ['y'],
      range: ['#abcdef'],
    })
    expect(display.rowColorScale.get('b')).toBe('#abcdef')
    expect(display.rowColorScale.get('a')).toBe(categoricalPalette[0])
  })

  it('starts each row its own from the colors the dialog left on the rows', () => {
    const display = makeGrouped({ rowColor: 'group' })
    display.applyRowEdits(recoloured(display), { field: 'name' })
    expect(display.rowColorChoice).toBe('name')
    expect(Object.fromEntries(display.rowColors)).toEqual({ b: '#123456' })
  })

  it('keeps the field and its colors under None, and returns to them', () => {
    const display = makeGrouped({
      rowColor: { field: 'group', domain: ['y'], range: ['#abcdef'] },
    })
    display.applyRowEdits(display.editableSources, {
      field: 'group',
      scale: 'none',
      domain: ['y'],
      range: ['#abcdef'],
    })
    expect(display.rowColorChoice).toBe('')
    expect(display.rowColorScale.size).toBe(0)
    display.applyRowEdits(display.editableSources, {
      field: 'group',
      domain: ['y'],
      range: ['#abcdef'],
    })
    expect(display.rowColorScale.get('b')).toBe('#abcdef')
  })

  it('brings back the pairs None kept when each row is its own again', () => {
    const display = makeGrouped({
      rowColor: { scale: 'none', domain: ['b'], range: ['#00f'] },
    })
    expect(display.rowColors.size).toBe(0)
    display.applyRowEdits(display.editableSources, { field: 'name' })
    expect(display.rowColorChoice).toBe('name')
    expect(Object.fromEntries(display.rowColors)).toEqual({ b: '#00f' })
  })

  it('writes nothing on a submit that changes nothing', () => {
    const display = makeGrouped({
      rowColor: { field: 'group', domain: ['y'], range: ['#abcdef'] },
    })
    const before = getSnapshot(display.configuration)
    display.applyRowEdits(display.editableSources, {
      field: 'group',
      domain: ['y'],
      range: ['#abcdef'],
    })
    expect(getSnapshot(display.configuration)).toBe(before)
  })
})
