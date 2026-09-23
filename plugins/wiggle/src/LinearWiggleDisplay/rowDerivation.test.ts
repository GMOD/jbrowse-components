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
  facet: domain ? { field: 'source', domain } : 'source',
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
    expect(display.sourcesWithoutLayout).toHaveLength(sources.length)
  })
  return display
}

function derived(display: LinearWiggleDisplayModel) {
  return {
    isOverlay: display.isOverlay,
    numRows: display.numRows,
    effectiveColor: display.effectiveColor,
    sources: display.sources.map(
      ({ name, label, color, labelColor, group }) => ({
        name,
        label,
        color,
        labelColor,
        group,
      }),
    ),
    legendItems: display.legendItems,
    overlayLegendApplies: display.overlayLegendApplies,
    rowTree: display.rowTree,
    rowArrangementIsCustom: display.rowArrangementIsCustom,
  }
}

test('overlay: adapter colours paint the plot', async () => {
  const display = await loaded(COLOURED, { defaultRendering: 'line' })
  expect(derived(display)).toMatchSnapshot()
})

test('overlay: a group palette, then a per-row palette for the ungrouped', async () => {
  const display = await loaded(GROUPED, {})
  expect(derived(display)).toMatchSnapshot()
})

test('overlay: a declared source palette leads the default one', async () => {
  const display = await loaded(GROUPED, {
    color: { field: 'source', range: ['#111111', '#222222'] },
  })
  expect(derived(display)).toMatchSnapshot()
})

test('rows, line: the adapter colour, then the group palette, then posColor', async () => {
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

test('rows: the declared order leads and the rest keep adapter order', async () => {
  const display = await loaded(GROUPED, rowsPerSource(['Grain3']))
  expect(derived(display)).toMatchSnapshot()
})

test('rows: a focus hides rows without recolouring the kept ones', async () => {
  const display = await loaded(GROUPED, rowsPerSource())
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
  })
  display.focusLegendEntry('sources', 'Islet')
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
    { ...g2!, color: '#00f' },
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
  display.applyRowEdits([g1!, { ...g2!, labelColor: '#00f' }, ...rest])
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
