import { rowPaletteColorAt } from '@jbrowse/core/ui/colors'

import { createTestEnvironment, ctgA } from './testEnv.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'

function rows(names: string[]): MultiRowRegionData {
  return {
    featureStarts: new Uint32Array(0),
    featureEnds: new Uint32Array(0),
    featureColors: new Uint32Array(0),
    rectColorValues: new Uint32Array(0),
    featureDeltas: new Int32Array(0),
    rowValues: names,
    featureRowValueIndex: new Uint32Array(0),
    featureNames: [],
    featureIds: [],
    usedItemRgb: false,
    rowsFieldCandidates: [],
    rowsFieldCandidateValues: [],
    legendCandidates: [],
    resolvedRowsField: 'sample',
  }
}

function loaded(displayConfig: Record<string, unknown>) {
  const { display } = createTestEnvironment({
    displayConfig: { rows: 'sample', ...displayConfig },
  }).createDisplay()
  display.setRpcData(0, rows(['a', 'b', 'c', '']), ctgA)
  return display
}

const DECLARED = { rowColor: { domain: ['c', 'a'], range: ['#0f0', '#00f'] } }

test('the dialog seeds each row with the colour the config gives it', () => {
  const display = loaded(DECLARED)
  expect(display.editableSources.map(s => s.rowColor)).toEqual([
    '#00f',
    undefined,
    '#0f0',
    undefined,
  ])
})

test('a reorder writes the declared pairs back in their own order', () => {
  const display = loaded(DECLARED)
  const [a, b, c, none] = display.editableSources
  display.applyRowEdits([c!, a!, b!, none!])
  expect(display.rowDomain).toEqual(['c', 'a', 'b', ''])
  expect(display.configuration.rowColor.domain).toEqual(['c', 'a'])
  expect(display.rowStylingIsCustom).toBe(false)
  expect(display.rowLabels).toEqual({})
})

test('a recolour is custom until a reset returns the declared colours', () => {
  const display = loaded(DECLARED)
  const [a, b, ...rest] = display.editableSources
  display.applyRowEdits([a!, { ...b!, rowColor: '#f00' }, ...rest])
  expect(display.rowColorPairs.get('b')).toBe('#f00')
  expect(display.rowStylingIsCustom).toBe(true)
  expect(display.rowArrangementIsCustom).toBe(true)

  display.resetRowArrangement()
  expect(Object.fromEntries(display.rowColorPairs)).toEqual({
    c: '#0f0',
    a: '#00f',
  })
  expect(display.rowArrangementIsCustom).toBe(false)
})

test('a colour the painters cannot parse is left out', () => {
  const display = loaded({})
  const [a, ...rest] = display.editableSources
  display.applyRowEdits([{ ...a!, rowColor: 'reddish' }, ...rest])
  expect(display.rowColorPairs.size).toBe(0)
})

test('the unanswered row stores a label only once it is renamed', () => {
  const display = loaded({})
  const [a, b, c, none] = display.editableSources
  expect(none!.label).toBe('(no sample)')
  display.applyRowEdits([a!, b!, c!, none!])
  expect(display.rowLabels).toEqual({})

  display.applyRowEdits([a!, b!, c!, { ...none!, label: 'Unassigned' }])
  expect(display.rowLabels).toEqual({ '': 'Unassigned' })
  expect(display.sources.at(-1)?.label).toBe('Unassigned')
})

test('a submit over a window holding a fraction of the rows leaves the rest standing', () => {
  const { display } = createTestEnvironment({
    displayConfig: {
      rows: { field: 'sample', labels: { c: 'Sea' } },
      ...DECLARED,
    },
  }).createDisplay()
  display.setRpcData(0, rows(['a', 'b']), ctgA)
  const [a, b] = display.editableSources
  display.applyRowEdits([b!, { ...a!, rowColor: '#f00' }])
  expect(display.configuration.rowColor.domain).toEqual(['c', 'a'])
  expect(Object.fromEntries(display.rowColorPairs)).toEqual({
    c: '#0f0',
    a: '#f00',
  })
  expect(display.rowLabels).toEqual({ c: 'Sea' })
  expect(display.rowDomain).toEqual(['b', 'a'])
})

// Each row has a lane of its own, so no palette deals the rows a colour by
// name: with no pair, no `color` and no itemRgb every block draws in the
// default colour, where a rainbow used to deal one per row.
test('deals no rainbow: an unpaired row paints the default block colour', () => {
  const display = loaded({})
  expect(display.rowPaletteDeals).toBe(false)
  expect(display.rowColorStringsByIndex).toEqual([
    undefined,
    undefined,
    undefined,
    undefined,
  ])
})

// The colours resolve over the base arrangement, once per change to the rows,
// so no reorder, focus or relabel resolves them again.
test('the row colours keep their identity across a reorder, a focus and a relabel', () => {
  const display = loaded(DECLARED)
  const palette = display.resolvedRowColors
  expect(palette.size).toBe(2)
  const [a, b, c, none] = display.editableSources
  display.setRowOrder([c!, b!, a!, none!])
  display.setRowFocus(['a', 'b'])
  display.applyRowEdits(
    display.editableSources.map(s => ({ ...s, label: `${s.name}!` })),
  )
  expect(display.rowLabels).toMatchObject({ a: 'a!' })
  expect(display.resolvedRowColors).toBe(palette)
})

test("unknown: '' deals no palette, and the pairs still paint", () => {
  const display = loaded({ rowColor: { ...DECLARED.rowColor, unknown: '' } })
  expect(display.rowColorStringsByIndex).toEqual([
    '#00f',
    undefined,
    '#0f0',
    undefined,
  ])
})

test('a recolour under None paints that row and deals the rest nothing', () => {
  const display = loaded({ rowColor: { unknown: '' } })
  const [a, b, ...rest] = display.editableSources
  display.applyRowEdits([a!, { ...b!, rowColor: '#123456' }, ...rest], {
    field: 'name',
    unknown: '',
  })
  expect(display.rowColorStringsByIndex).toEqual([
    undefined,
    '#123456',
    undefined,
    undefined,
  ])
})

const GROUPS = {
  rowGroups: [
    { match: '^[ab]$', group: 'AB' },
    { match: '^c$', group: 'C' },
  ],
}

test('rowColor by group deals a colour per group, and offers the field', () => {
  const display = loaded({ rowColor: 'group', ...GROUPS })
  expect(display.rowColorFields).toEqual(['group'])
  const [a, b, c] = display.rowColorStringsByIndex
  expect(a).toBe(rowPaletteColorAt(0))
  expect(b).toBe(a)
  expect(c).toBe(rowPaletteColorAt(1))
  expect(loaded({}).rowColorFields).toEqual([])
})

test('rowGroups that tag no row offer no group field', () => {
  const display = loaded({ rowGroups: [{ match: '^z$', group: 'Z' }] })
  expect(display.rowColorFields).toEqual([])
})

test('rowColor by group pairs its domain with its range, on the blocks and the label bar alike', () => {
  const display = loaded({
    rowColor: {
      field: 'group',
      domain: ['AB', 'C'],
      range: ['#e41a1c', '#123456'],
    },
    ...GROUPS,
  })
  expect(display.rowColorStringsByIndex.slice(0, 3)).toEqual([
    '#e41a1c',
    '#e41a1c',
    '#123456',
  ])
  expect(display.sources.slice(0, 3).map(s => s.rowColor)).toEqual([
    '#e41a1c',
    '#e41a1c',
    '#123456',
  ])
})

// A row matching no `rowGroups` entry has no group, which is a missing value
// rather than a category, as ggplot's `na.value`: the palette deals it nothing,
// and neither does `unknown`.
test('a row with no group takes no colour from the deal', () => {
  const dealt = loaded({ rowColor: 'group', ...GROUPS })
  expect(dealt.sources[3]!.name).toBe('')
  expect(dealt.sources[3]!.rowColor).toBeUndefined()
  expect(dealt.dealtRowColors.has('')).toBe(false)
  expect(dealt.rowColorStringsByIndex[3]).toBeUndefined()

  const unknown = loaded({
    rowColor: {
      field: 'group',
      domain: ['C'],
      range: ['#123456'],
      unknown: '#999999',
    },
    ...GROUPS,
  })
  expect(unknown.rowColorStringsByIndex).toEqual([
    '#999999',
    '#999999',
    '#123456',
    undefined,
  ])
})

test('a pair naming the empty value paints the rows with no group', () => {
  const display = loaded({
    rowColor: { field: 'group', domain: [''], range: ['#cccccc'] },
    ...GROUPS,
  })
  expect(display.rowColorStringsByIndex[3]).toBe('#cccccc')
})
