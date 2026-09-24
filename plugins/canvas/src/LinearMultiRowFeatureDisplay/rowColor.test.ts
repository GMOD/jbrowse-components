import { createTestEnvironment, ctgA } from './testEnv.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'

function rows(names: string[]): MultiRowRegionData {
  return {
    featureStarts: new Uint32Array(0),
    featureEnds: new Uint32Array(0),
    featureColors: new Uint32Array(0),
    featureDeltas: new Int32Array(0),
    partitionValues: names,
    featurePartitionIndex: new Uint32Array(0),
    featureNames: [],
    featureIds: [],
    usedItemRgb: false,
    partitionCandidates: [],
    partitionCandidateValues: [],
    legendCandidates: [],
    resolvedPartitionField: 'sample',
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
  expect(display.editableSources.map(s => s.color)).toEqual([
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
  display.applyRowEdits([a!, { ...b!, color: '#f00' }, ...rest])
  expect(display.rowColors.get('b')).toBe('#f00')
  expect(display.rowStylingIsCustom).toBe(true)
  expect(display.rowArrangementIsCustom).toBe(true)

  display.resetRowArrangement()
  expect(Object.fromEntries(display.rowColors)).toEqual({
    c: '#0f0',
    a: '#00f',
  })
  expect(display.rowArrangementIsCustom).toBe(false)
})

test('a colour the painters cannot parse is left out', () => {
  const display = loaded({})
  const [a, ...rest] = display.editableSources
  display.applyRowEdits([{ ...a!, color: 'reddish' }, ...rest])
  expect(display.rowColors.size).toBe(0)
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
  display.applyRowEdits([b!, { ...a!, color: '#f00' }])
  expect(display.configuration.rowColor.domain).toEqual(['c', 'a'])
  expect(Object.fromEntries(display.rowColors)).toEqual({
    c: '#0f0',
    a: '#f00',
  })
  expect(display.rowLabels).toEqual({ c: 'Sea' })
  expect(display.rowDomain).toEqual(['b', 'a'])
})

// The palette is dealt over the base arrangement, once per change to the rows,
// so no reorder, focus or relabel deals it again.
test('the row palette keeps its identity across a reorder, a focus and a relabel', () => {
  const display = loaded(DECLARED)
  const palette = display.rowColorScale
  expect(palette.size).toBe(4)
  const [a, b, c, none] = display.editableSources
  display.setRowOrder([c!, b!, a!, none!])
  display.setRowFocus(['a', 'b'])
  display.applyRowEdits(
    display.editableSources.map(s => ({ ...s, label: `${s.name}!` })),
  )
  expect(display.rowLabels).toMatchObject({ a: 'a!' })
  expect(display.rowColorScale).toBe(palette)
})
