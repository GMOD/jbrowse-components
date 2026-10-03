import {
  ConfigurationSchema,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { rowPaletteColorAt } from '@jbrowse/core/ui/colors'
import { rowArrangementConfigSchema } from '@jbrowse/display-kit/rowArrangementConfigSchema'
import { rowColorConfigSchema } from '@jbrowse/display-kit/rowColorConfigSchema'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { TreeSidebarMixin } from './TreeSidebarMixin.ts'
import { getLeafNames } from './clusterUtils.ts'
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
      { name: 'b', rowColor: '#00f' },
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

// `((a,b),c)` has four of the six orders of its leaves as rotations; a, c, b
// parts the sister pair, so no rotation lists it.
describe('a guide tree the display supplies', () => {
  const GUIDE = '((a,b),c);'
  const named = (names: string[]) => names.map(name => ({ name }))

  function makeGuided() {
    return types
      .compose(
        'GuidedTreeDisplay',
        TreeSidebarMixin(),
        types.model({
          type: types.literal('GuidedTreeDisplay'),
          configuration: configSchema,
        }),
      )
      .views(() => ({
        get discoveredRows() {
          return named(['a', 'b', 'c'])
        },
        get guideTreeNewick() {
          return GUIDE
        },
      }))
      .create({ type: 'GuidedTreeDisplay', configuration: {} })
  }

  it('draws while the domain honours a rotation of it', () => {
    const display = makeGuided()
    expect(display.rowTree).toBe(GUIDE)
    expect(display.rowOrderWillDropTree(named(['c', 'b', 'a']))).toBe(false)
    display.setRowOrder(named(['c', 'b', 'a']))
    expect(display.rowTree).toBe(GUIDE)
    expect(getLeafNames(display.parsedTree!)).toEqual(['c', 'b', 'a'])
  })

  it('hides under an order no rotation produces, and returns on reset', () => {
    const display = makeGuided()
    expect(display.rowOrderWillDropTree(named(['a', 'c', 'b']))).toBe(true)
    display.setRowOrder(named(['a', 'c', 'b']))
    expect(display.rowTree).toBeUndefined()
    expect(display.parsedTree).toBeUndefined()
    display.resetRowArrangement()
    expect(display.rowTree).toBe(GUIDE)
    expect(getLeafNames(display.parsedTree!)).toEqual(['a', 'b', 'c'])
  })

  // The guide tree lists c, a, b too, so only the run's tree can be the one
  // drawn, and any move drops it.
  it("yields to a run's tree in `rows.tree`", () => {
    const display = makeGuided()
    const runTree = '(c,(a,b));'
    display.setRowOrder(named(['c', 'a', 'b']), {
      tree: runTree,
      provenance: { regions: [{ refName: 'ctgA', start: 0, end: 100 }] },
    })
    expect(display.guideTreeHonoursDomain).toBe(true)
    expect(display.rowTree).toBe(runTree)
    expect(display.rowOrderWillDropTree(named(['c', 'b', 'a']))).toBe(true)
    display.resetRowArrangement()
    expect(display.rowTree).toBe(GUIDE)
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

const p = rowPaletteColorAt

interface TestRow {
  name: string
  group?: string
  color?: string
}

const GROUPED: TestRow[] = [
  { name: 'a', group: 'x' },
  { name: 'b', group: 'y' },
  { name: 'c', group: 'x' },
]

// A display over `rows`, sharing one panel where `shared` is set and its row
// colours painting its marks unless `paintsMarks` is false.
function makeRowDisplay(
  configuration: Record<string, unknown> = {},
  {
    rows = GROUPED,
    shared = false,
    paintsMarks = true,
  }: { rows?: TestRow[]; shared?: boolean; paintsMarks?: boolean } = {},
) {
  return types
    .compose(
      'RowColorTreeDisplay',
      TreeSidebarMixin(),
      types.model({
        type: types.literal('RowColorTreeDisplay'),
        configuration: configSchema,
      }),
    )
    .volatile(() => ({ rows }))
    .views(self => ({
      get discoveredRows() {
        return self.rows
      },
      get sharesPanel() {
        return shared
      },
      get rowColorPaintsMarks() {
        return paintsMarks
      },
    }))
    .create({ type: 'RowColorTreeDisplay', configuration })
}

const colorsOf = (display: {
  resolvedRowColors: ReadonlyMap<string, string>
}) => Object.fromEntries(display.resolvedRowColors)

describe('rowPaletteDeals', () => {
  it.each([
    [false, true, false],
    [true, false, false],
    [true, true, true],
  ])(
    'sharesPanel %s and rowColorPaintsMarks %s deal names: %s',
    (shared, paintsMarks, deals) => {
      const display = makeRowDisplay({}, { shared, paintsMarks })
      expect(display.rowPaletteDeals).toBe(deals)
      expect(display.resolvedRowColors.size).toBe(deals ? 3 : 0)
    },
  )
})

describe('resolvedRowColors', () => {
  const OWN: TestRow[] = [
    { name: 'a' },
    { name: 'b', color: '#0b0b0b' },
    { name: 'c' },
    { name: 'd', color: '#0d0d0d' },
  ]

  it('takes a pair over the own colour, and the own colour over the palette', () => {
    const display = makeRowDisplay(
      { rowColor: { domain: ['d'], range: ['#00f'] } },
      { rows: OWN, shared: true },
    )
    expect(colorsOf(display)).toEqual({
      a: p(0),
      b: '#0b0b0b',
      c: p(1),
      d: '#00f',
    })
  })

  it('deals no name a turn to a row carrying its own colour', () => {
    const display = makeRowDisplay({}, { rows: OWN, shared: true })
    expect(Object.fromEntries(display.dealtRowColors)).toEqual({
      a: p(0),
      c: p(1),
    })
  })

  it('gives a row only its pair or its own colour where no panel is shared', () => {
    const display = makeRowDisplay(
      { rowColor: { domain: ['a'], range: ['#00f'] } },
      { rows: OWN },
    )
    expect(colorsOf(display)).toEqual({
      a: '#00f',
      b: '#0b0b0b',
      d: '#0d0d0d',
    })
  })

  it("takes an attribute's colour over the own colour", () => {
    const display = makeRowDisplay(
      { rowColor: 'group' },
      { rows: [{ name: 'a', group: 'x', color: '#0a0a0a' }, { name: 'b' }] },
    )
    expect(colorsOf(display)).toEqual({ a: p(0) })
  })

  // A row with no value is missing, not a category, as ggplot's `na.value`:
  // the deal and `unknown` pass it by, and it keeps its own colour.
  describe('a row with no value of the attribute', () => {
    const SPARSE: TestRow[] = [
      { name: 'a', group: 'x' },
      { name: 'b', group: '' },
      { name: 'c' },
      { name: 'd', color: '#0d0d0d' },
      { name: 'e', group: 'y' },
    ]

    it('takes no palette turn, and keeps its own colour', () => {
      for (const shared of [false, true]) {
        const display = makeRowDisplay(
          { rowColor: 'group' },
          { rows: SPARSE, shared },
        )
        expect(colorsOf(display)).toEqual({
          a: p(0),
          d: '#0d0d0d',
          e: p(1),
        })
      }
    })

    it('takes no unknown colour', () => {
      const display = makeRowDisplay(
        {
          rowColor: { field: 'group', domain: [], range: [], unknown: '#ccc' },
        },
        { rows: SPARSE },
      )
      expect(colorsOf(display)).toEqual({
        a: '#ccc',
        d: '#0d0d0d',
        e: '#ccc',
      })
    })

    it("takes the colour a pair names '' by", () => {
      const display = makeRowDisplay(
        { rowColor: { field: 'group', domain: [''], range: ['#eee'] } },
        { rows: SPARSE },
      )
      expect(colorsOf(display)).toEqual({
        a: p(0),
        b: '#eee',
        c: '#eee',
        d: '#eee',
        e: p(1),
      })
    })
  })

  it("leaves the own colour under scale: 'none'", () => {
    const display = makeRowDisplay(
      { rowColor: { scale: 'none', domain: ['b'], range: ['#00f'] } },
      { rows: OWN, shared: true },
    )
    expect(colorsOf(display)).toEqual({ b: '#0b0b0b', d: '#0d0d0d' })
  })

  it('deals nothing by an attribute no row carries', () => {
    expect(makeRowDisplay({ rowColor: 'tissue' }).resolvedRowColors.size).toBe(
      0,
    )
  })

  it('paints an unknown colour on the unlisted rows without their own, shared panel or not', () => {
    for (const shared of [false, true]) {
      const display = makeRowDisplay(
        { rowColor: { domain: ['a'], range: ['#00f'], unknown: '#ccc' } },
        { rows: OWN, shared },
      )
      expect(colorsOf(display)).toEqual({
        a: '#00f',
        b: '#0b0b0b',
        c: '#ccc',
        d: '#0d0d0d',
      })
      expect(display.rowColorChoice).toBe('name')
    }
  })

  it("paints only the pairs under unknown: ''", () => {
    const display = makeRowDisplay(
      { rowColor: { domain: ['a'], range: ['#00f'], unknown: '' } },
      { rows: OWN, shared: true },
    )
    expect(colorsOf(display)).toEqual({
      a: '#00f',
      b: '#0b0b0b',
      d: '#0d0d0d',
    })
  })
})

// The palette deals the rowColor field's values over the base arrangement,
// the listed values taking their range colour.
describe('the row palette', () => {
  const makePalette = (configuration: Record<string, unknown> = {}) =>
    makeRowDisplay(configuration, { shared: true })

  it('deals the unlisted rows tableau10 in the base arrangement', () => {
    const display = makePalette({
      rowColor: { domain: ['b'], range: ['#00f'] },
    })
    expect(colorsOf(display)).toEqual({ a: p(0), b: '#00f', c: p(1) })
  })

  it('deals by another row attribute, first seen first', () => {
    const display = makeRowDisplay({ rowColor: 'group' })
    expect(colorsOf(display)).toEqual({ a: p(0), b: p(1), c: p(0) })
  })

  it('deals none under scale none', () => {
    const display = makePalette({ rowColor: { field: 'group', scale: 'none' } })
    expect(display.resolvedRowColors.size).toBe(0)
  })

  // Observed, as a display's paint path observes it: an unobserved computed
  // deals again on every read.
  it('keeps its identity across a reorder, a focus and a relabel', () => {
    const display = makePalette()
    const stop = autorun(() => display.resolvedRowColors)
    const palette = display.resolvedRowColors
    display.setRowOrder([{ name: 'c' }, { name: 'b' }, { name: 'a' }])
    display.setRowFocus(['a'])
    display.applyRowEdits(
      display.editableSources.map(r => ({ ...r, label: r.name.toUpperCase() })),
    )
    expect(display.rowLabels).toEqual({ a: 'A', b: 'B', c: 'C' })
    expect(display.resolvedRowColors).toBe(palette)
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
    expect(Object.fromEntries(preview)).toEqual({ x: p(0), y: '#abcdef' })
  })
})

// The dialog shows one `rowColor` object and submits it: a row's colour is
// read only while the rows are coloured each their own.
describe('a dialog submit of the row colours', () => {
  const makeGrouped = (configuration: Record<string, unknown> = {}) =>
    makeRowDisplay(configuration, { shared: true })
  const recoloured = (display: ReturnType<typeof makeGrouped>) => {
    const [a, b, c] = display.editableSources
    return [a!, { ...b!, rowColor: '#123456' }, c!]
  }

  it('reads no row colour while the rows are colored by an attribute', () => {
    const display = makeGrouped({ rowColor: 'group' })
    const before = colorsOf(display)
    display.applyRowEdits(recoloured(display))
    expect(display.rowColorChoice).toBe('group')
    expect(colorsOf(display)).toEqual(before)
  })

  it("writes an attribute's colors as the dialog shows them", () => {
    const display = makeGrouped({ rowColor: 'group' })
    display.applyRowEdits(display.editableSources, {
      field: 'group',
      domain: ['y'],
      range: ['#abcdef'],
    })
    expect(display.resolvedRowColors.get('b')).toBe('#abcdef')
    expect(display.resolvedRowColors.get('a')).toBe(p(0))
  })

  it('starts each row its own from the colors the dialog left on the rows', () => {
    const display = makeGrouped({ rowColor: 'group' })
    display.applyRowEdits(recoloured(display), { field: 'name' })
    expect(display.rowColorChoice).toBe('name')
    expect(Object.fromEntries(display.rowColorPairs)).toEqual({ b: '#123456' })
  })

  it("paints nothing under scale: 'none', its pairs kept for the way back", () => {
    const display = makeGrouped({
      rowColor: { scale: 'none', domain: ['b'], range: ['#00f'] },
    })
    expect(display.rowColorChoice).toBe('')
    expect(display.rowColorPairs.size).toBe(0)
    expect(display.resolvedRowColors.size).toBe(0)
  })

  it("paints only the values an unknown: '' lists", () => {
    const display = makeGrouped({
      rowColor: {
        field: 'group',
        domain: ['y'],
        range: ['#abcdef'],
        unknown: '',
      },
    })
    expect(display.rowColorChoice).toBe('group')
    expect(colorsOf(display)).toEqual({ b: '#abcdef' })
  })

  it('gives every value an unknown colour the pairs leave out', () => {
    const display = makeGrouped({
      rowColor: { domain: ['b'], range: ['#00f'], unknown: '#ccc' },
    })
    expect(display.rowColorChoice).toBe('name')
    expect(colorsOf(display)).toEqual({ a: '#ccc', b: '#00f', c: '#ccc' })
  })

  it('recolours one row under None and leaves the rest unpainted', () => {
    const display = makeGrouped({ rowColor: { scale: 'none' } })
    display.applyRowEdits(recoloured(display), { field: 'name', unknown: '' })
    expect(display.rowColorChoice).toBe('')
    expect(Object.fromEntries(display.rowColorPairs)).toEqual({ b: '#123456' })
    expect(colorsOf(display)).toEqual({ b: '#123456' })
  })

  it('keeps the colours set on rows when Each row turns into None', () => {
    const display = makeGrouped({
      rowColor: { domain: ['b'], range: ['#00f'] },
    })
    expect(display.resolvedRowColors.size).toBe(3)
    display.applyRowEdits(display.editableSources, {
      field: 'name',
      unknown: '',
    })
    expect(display.rowColorChoice).toBe('')
    expect(colorsOf(display)).toEqual({ b: '#00f' })
  })

  it('clears a row colour under None', () => {
    const display = makeGrouped({
      rowColor: { domain: ['b'], range: ['#00f'], unknown: '' },
    })
    expect(display.editableSources.find(r => r.name === 'b')!.rowColor).toBe(
      '#00f',
    )
    display.applyRowEdits(
      display.editableSources.map(r => ({ ...r, rowColor: undefined })),
      { field: 'name', unknown: '' },
    )
    expect(display.rowColorChoice).toBe('')
    expect(display.rowColorPairs.size).toBe(0)
  })

  it('a submit with no colour object keeps a parked object', () => {
    const parked = {
      field: 'group',
      scale: 'none',
      domain: ['y'],
      range: ['#abcdef'],
    }
    const display = makeGrouped({ rowColor: parked })
    display.applyRowEdits([...display.editableSources].reverse())
    expect(display.rowColorSetting).toEqual(parked)
    expect(display.rowColorChoice).toBe('')
  })

  it("a submit with no colour object keeps unknown: '#ccc'", () => {
    const display = makeGrouped({
      rowColor: { domain: ['b'], range: ['#00f'], unknown: '#ccc' },
    })
    display.applyRowEdits(
      display.editableSources.map(r => ({ ...r, label: r.name.toUpperCase() })),
    )
    expect(display.rowColorSetting.unknown).toBe('#ccc')
    expect(colorsOf(display)).toEqual({ a: '#ccc', b: '#00f', c: '#ccc' })
  })

  it('counts None as custom, and a reset deals the palette again', () => {
    const display = makeGrouped()
    display.applyRowEdits(display.editableSources, {
      field: 'name',
      unknown: '',
    })
    expect(display.resolvedRowColors.size).toBe(0)
    expect(display.rowStylingIsCustom).toBe(true)
    display.resetRowArrangement()
    expect(display.rowColorSetting.unknown).toBeUndefined()
    expect(display.resolvedRowColors.size).toBe(3)
  })

  it('counts a value recolour as custom, and a reset keeps the color by', () => {
    const display = makeGrouped()
    display.applyRowEdits(display.editableSources, { field: 'group' })
    expect(display.rowStylingIsCustom).toBe(false)
    display.applyRowEdits(display.editableSources, {
      field: 'group',
      domain: ['y'],
      range: ['#abcdef'],
    })
    expect(display.rowStylingIsCustom).toBe(true)
    display.resetRowArrangement()
    expect(display.rowColorChoice).toBe('group')
    expect(display.resolvedRowColors.get('b')).toBe(p(1))
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
