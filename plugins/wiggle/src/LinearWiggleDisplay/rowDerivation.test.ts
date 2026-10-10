import { rowPaletteColorAt } from '@jbrowse/core/ui/colors'
import { pairedColorsOf } from '@jbrowse/display-kit/colorConfigSchema'
import { SIDEBAR_HINT_LINE_PX, sidebarPanelWidth } from '@jbrowse/tree-sidebar'
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

const COLORED: SourceInfo[] = [
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

test('overlay: adapter colors paint the plot', async () => {
  const display = await loaded(COLORED, { defaultRendering: 'line' })
  expect(derived(display)).toMatchSnapshot()
})

// Several subtracks share the box, so the palette deals tableau10 by name; a
// group is an attribute and colors nothing until rowColor names it.
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

// Each subtrack has a row of its own, so it draws in the plot color unless
// rowColor or the file gives it one.
test('rows, line: the adapter color, else the plot color', async () => {
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

// A color by an attribute is the reader's choice, so its color leads a
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

test('rows: a focus starts the rows under the focus chip s line', async () => {
  const display = await loaded(GROUPED, rowsPerSource())
  const firstRowTop = () => display.valueScales[0]!.bandTops![0]
  expect(display.plotGeometry.yTop).toBe(0)
  expect(firstRowTop()).toBe(0)
  display.setRowFocus(['Grain2', 'Grain4'])
  const { yTop, plotHeight } = display.plotGeometry
  expect(yTop).toBe(SIDEBAR_HINT_LINE_PX)
  expect(firstRowTop()).toBe(SIDEBAR_HINT_LINE_PX)
  expect(yTop + plotHeight).toBe(display.height)
  expect(display.effectiveRowHeight * 2).toBe(plotHeight)
})

test('rows: the scale sits past the row labels, and at the edge without them', async () => {
  const display = await loaded(GROUPED, rowsPerSource())
  const left = () => display.valueScales[0]!.left
  expect(left()).toBe(sidebarPanelWidth(display.sidebarPanel))
  expect(left()).toBeGreaterThan(0)
  display.setShowRowLabels(false)
  expect(left()).toBe(0)
})

test('rows: the declared order leads and the rest keep adapter order', async () => {
  const display = await loaded(GROUPED, rowsPerSource(['Grain3']))
  expect(derived(display)).toMatchSnapshot()
})

test('rows: a focus hides rows without recoloring the kept ones', async () => {
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

test('rows, line: dialog edits reorder, recolor the plot and relabel', async () => {
  const display = await loaded(GROUPED, {
    ...rowsPerSource(),
    defaultRendering: 'line',
  })
  const [g1, g2, g3, g4] = display.editableSources
  display.applyRowEdits([{ ...g3!, label: 'Liver 3' }, g2!, g4!, g1!], {
    domain: [g2!.name],
    range: ['#00f'],
  })
  expect(derived(display)).toMatchSnapshot()
  display.resetRowArrangement()
  expect(derived(display)).toMatchSnapshot()
})

test('rows, density: a dialog edit tints the label', async () => {
  const display = await loaded(GROUPED, {
    ...rowsPerSource(),
    defaultRendering: 'density',
  })
  const [, g2] = display.editableSources
  display.applyRowEdits(display.editableSources, {
    domain: [g2!.name],
    range: ['#00f'],
  })
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

// In one shared box there is no label to tint, so a color set in the dialog
// goes to the plot whatever the gradient, as it did before the port.
test('overlay, density: a dialog edit paints the plot', async () => {
  const display = await loaded(GROUPED, { defaultRendering: 'density' })
  display.applyRowEdits(display.editableSources, {
    domain: ['Grain1'],
    range: ['#00f'],
  })
  expect(display.markSources[0]).toEqual({ name: 'Grain1', color: '#00f' })
  expect(pairedColorsOf(display.rowColorSetting).get('Grain1')).toBe('#00f')
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

// A reorder alone writes the config's own color pairs back in their order,
// so it leaves no styling delta and offers no reset for a recolor.
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
})
