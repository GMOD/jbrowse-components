import { rowPaletteColorAt } from '@jbrowse/core/ui/colors'
import { waitFor } from '@testing-library/react'

import { createTestEnvironment, makeSource } from './testEnv.ts'

import type { LinearWiggleDisplayModel } from './model.ts'
import type { SourceInfo } from '@jbrowse/wiggle-core'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

// The setting that puts each source on a row of its own, spelled once: the
// derivation pinned below is what has to survive the setting's own rename.
const rowsPerSource = (domain?: string[]) => ({
  rows: domain ? { field: 'source', domain } : 'source',
})

const GROUPED: SourceInfo[] = [
  { name: 'Grain1', group: 'Islet', color: '#f00' },
  { name: 'Grain2', group: 'Islet' },
  { name: 'Grain3', group: 'Liver' },
  { name: 'Grain4' },
]

const COLOURED: SourceInfo[] = [
  { name: 'Grain1', color: '#f00' },
  { name: 'Grain2', color: '#f60' },
  { name: 'Grain3', color: '#fa0' },
]

async function loaded(
  sources: SourceInfo[],
  displayConfig: Record<string, unknown>,
) {
  const env = createTestEnvironment({ displayConfig })
  env.mockRpcCall.mockImplementation(() =>
    Promise.resolve([
      { sources: sources.map(s => ({ ...makeSource(s.name), ...s })) },
    ]),
  )
  const { display } = env.createDisplay()
  jest.advanceTimersByTime(700)
  await waitFor(() => {
    expect(display.discoveredRows).toHaveLength(sources.length)
  })
  return display
}

function derived(display: LinearWiggleDisplayModel) {
  return {
    isOverlay: display.isOverlay,
    numRows: display.numRows,
    effectiveColor: display.effectiveColor,
    sources: display.sources.map(({ name, label, color, rowColor, group }) => ({
      name,
      label,
      color,
      rowColor,
      group,
    })),
    markColors: display.markSources.map(s => s.color),
    rowColorKey:
      display.legendSpec.sections.find(s => s.id === 'rowColor')?.items ?? [],
    rowTree: display.rowTree,
    rowArrangementIsCustom: display.rowArrangementIsCustom,
  }
}

test('overlay: adapter colours paint the plot', async () => {
  const display = await loaded(COLOURED, { defaultRendering: 'line' })
  expect(derived(display)).toMatchSnapshot()
})

// Several subtracks share the box, so the palette deals tableau10 by name; a
// group is an attribute and colours nothing until rowColor names it.
test('overlay: tableau10 by name, grouped or not', async () => {
  const display = await loaded(GROUPED, {})
  expect(derived(display)).toMatchSnapshot()
})

test("overlay: rowColor's spare range leads the palette", async () => {
  const display = await loaded(GROUPED, {
    rowColor: { range: ['#111111', '#222222'] },
  })
  expect(derived(display)).toMatchSnapshot()
})

// Each subtrack has a row of its own, so it draws in the plot colour unless
// rowColor or the file gives it one.
test('rows, line: the adapter colour, else the plot colour', async () => {
  const display = await loaded(GROUPED, {
    ...rowsPerSource(),
    defaultRendering: 'line',
  })
  expect(derived(display)).toMatchSnapshot()
})

test('rows, density: identity moves to the label tint', async () => {
  const display = await loaded(GROUPED, {
    ...rowsPerSource(),
    defaultRendering: 'density',
  })
  expect(derived(display)).toMatchSnapshot()
})

// A colour by an attribute is the reader's choice, so its colour leads a
// subtrack's own, which leads the palette only under `name`. A subtrack with no
// group is missing a value rather than in a category, so the deal skips it.
test('rows colored by an attribute take its values colors over their own', async () => {
  const display = await loaded(GROUPED, {
    ...rowsPerSource(),
    defaultRendering: 'line',
    rowColor: 'group',
  })
  expect(display.rowColorFields).toEqual(['group'])
  expect(
    Object.fromEntries(display.markSources.map(s => [s.name, s.color])),
  ).toEqual({
    Grain1: rowPaletteColorAt(0),
    Grain2: rowPaletteColorAt(0),
    Grain3: rowPaletteColorAt(1),
    Grain4: undefined,
  })
})

test('rows: the declared order leads and the rest keep adapter order', async () => {
  const display = await loaded(GROUPED, rowsPerSource(['Grain3']))
  expect(derived(display)).toMatchSnapshot()
})

test('rows: a focus hides rows without recolouring the kept ones', async () => {
  const display = await loaded(GROUPED, {
    ...rowsPerSource(),
    rowColor: 'group',
  })
  display.setRowFocus(['Grain2', 'Grain4'])
  expect(derived(display)).toMatchSnapshot()
  display.setRowFocus(undefined)
  expect(display.sources.map(s => s.name)).toEqual([
    'Grain1',
    'Grain2',
    'Grain3',
    'Grain4',
  ])
})

test('rows: a legend click focuses the group it names', async () => {
  const display = await loaded(GROUPED, {
    ...rowsPerSource(),
    defaultRendering: 'density',
    rowColor: 'group',
  })
  display.focusLegendEntry('rowColor', 'Islet')
  expect(display.sources.map(s => s.name)).toEqual(['Grain1', 'Grain2'])
})

test('rows, line: dialog edits reorder, recolour the plot and relabel', async () => {
  const display = await loaded(GROUPED, {
    ...rowsPerSource(),
    defaultRendering: 'line',
  })
  const [g1, g2, g3, g4] = display.editableSources
  display.applyRowEdits([
    { ...g3!, label: 'Liver 3' },
    { ...g2!, rowColor: '#00f' },
    g4!,
    g1!,
  ])
  expect(derived(display)).toMatchSnapshot()
  display.resetRowArrangement()
  expect(derived(display)).toMatchSnapshot()
})

test('rows, density: a dialog edit tints the label', async () => {
  const display = await loaded(GROUPED, {
    ...rowsPerSource(),
    defaultRendering: 'density',
  })
  const [g1, g2, ...rest] = display.editableSources
  display.applyRowEdits([g1!, { ...g2!, rowColor: '#00f' }, ...rest])
  expect(derived(display)).toMatchSnapshot()
})

test('rows: a run lands its tree, a reorder drops it, a reset returns to the seed', async () => {
  const display = await loaded(GROUPED, rowsPerSource(['Grain3']))
  const provenance = {
    regions: [{ refName: 'ctgA', start: 0, end: 4000 }],
    settings: [],
  }
  const [g3, g1, g2, g4] = display.editableSources
  display.setRowOrder([g2!, g1!, g3!, g4!], {
    tree: '((Grain2,Grain1),(Grain3,Grain4));',
    provenance,
  })
  expect(derived(display)).toMatchSnapshot()
  expect(display.rowTreeProvenance).toEqual(provenance)
  expect(display.rowOrderWillDropTree([g1!, g2!, g3!, g4!])).toBe(true)
  expect(display.rowOrderWillDropTree([g2!, g1!, g3!, g4!])).toBe(false)

  display.setRowOrder([g1!, g2!, g3!, g4!])
  expect(derived(display)).toMatchSnapshot()

  display.resetRowArrangement()
  expect(derived(display)).toMatchSnapshot()
})

// In one shared box there is no label to tint, so a colour set in the dialog
// goes to the plot whatever the gradient, as it did before the port.
test('overlay, density: a dialog edit paints the plot', async () => {
  const display = await loaded(GROUPED, { defaultRendering: 'density' })
  const [g1, ...rest] = display.editableSources
  display.applyRowEdits([{ ...g1!, rowColor: '#00f' }, ...rest])
  expect(display.markSources[0]).toEqual({ name: 'Grain1', color: '#00f' })
  expect(display.rowColorPairs.get('Grain1')).toBe('#00f')
})

// The Edit plot box writes rows whole: an order typed over what it shows keeps
// the labels and the focus beside it, and a rows naming only its order drops
// them, as a config file naming only that would.
test('rows: the plot box writes rows whole', async () => {
  const display = await loaded(GROUPED, rowsPerSource())
  const [g1, g2, g3, g4] = display.editableSources
  display.applyRowEdits([{ ...g1!, label: 'One' }, g2!, g3!, g4!])
  display.setRowFocus(['Grain1', 'Grain2'])
  display.setRowOrder([g1!, g2!, g3!, g4!], {
    tree: '((Grain1,Grain2),(Grain3,Grain4));',
  })

  const draft = structuredClone(display.plot) as { rows: { domain: string[] } }
  draft.rows.domain = ['Grain2', 'Grain1']
  display.applyPlot(draft)
  expect(display.sources.map(s => s.name)).toEqual(['Grain2', 'Grain1'])
  expect(display.rowLabels).toEqual({ Grain1: 'One' })
  expect(display.rowFocus).toEqual(['Grain1', 'Grain2'])

  display.applyPlot({ rows: { field: 'source', domain: ['Grain2', 'Grain1'] } })
  expect(display.sources.map(s => s.name)).toEqual([
    'Grain2',
    'Grain1',
    'Grain3',
    'Grain4',
  ])
  expect(display.rowLabels).toEqual({})
  expect(display.rowFocus).toBeUndefined()
  expect(display.rowTree).toBeUndefined()

  expect(() => display.plotProblems({ rows: { field: 'group' } })).toThrow()

  display.applyPlot({ rows: null })
  expect(display.isOverlay).toBe(true)
  expect(display.rowArrangementIsCustom).toBe(false)
})

// A reorder alone writes the config's own colour pairs back in their order,
// so it leaves no styling delta and offers no reset for a recolour.
test('rows: a reorder keeps the declared rowColor as it was', async () => {
  const display = await loaded(GROUPED, {
    ...rowsPerSource(),
    rowColor: { domain: ['Grain3', 'Grain1'], range: ['#0f0', '#00f'] },
  })
  expect(display.rowStylingIsCustom).toBe(false)
  const [g1, g2, g3, g4] = display.editableSources
  display.applyRowEdits([g1!, g3!, g2!, g4!])
  expect(display.configuration.rowColor.domain).toEqual(['Grain3', 'Grain1'])
  expect(display.rowStylingIsCustom).toBe(false)

  display.applyRowEdits([{ ...g2!, rowColor: 'reddish' }, g1!, g3!, g4!])
  expect(display.rowColorPairs.has('Grain2')).toBe(false)
})
