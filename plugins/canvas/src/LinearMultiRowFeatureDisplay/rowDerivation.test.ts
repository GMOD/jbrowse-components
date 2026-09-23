import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import { runMultiRowClustering } from './runMultiRowClustering.ts'
import { createTestEnvironment, ctgA } from './testEnv.ts'

import type { LinearMultiRowFeatureDisplayModel } from './model.ts'
import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'
import type { RowGroup } from './rowSources.ts'

type Display = LinearMultiRowFeatureDisplayModel

interface Arrangement {
  field?: string
  domain?: string[]
  colors?: Record<string, string>
}

// The row settings, spelled once: the derivation pinned below is what has to
// survive their move into the `rows` and `rowColor` objects, so this helper is
// all of the file that move may change.
function arrangementConfig({ field = 'sample', domain, colors }: Arrangement) {
  return {
    rows: domain ? { field, domain } : field,
    ...(colors
      ? {
          rowColor: {
            domain: Object.keys(colors),
            range: Object.values(colors),
          },
        }
      : {}),
  }
}

interface Block {
  row: string
  start: number
  end: number
  color: string
}

// At base 100 dad and s2 paint red, mom blue and the unanswered row green;
// s10 starts past it.
const FAMILY: Block[] = [
  { row: 's10', start: 500, end: 1000, color: 'blue' },
  { row: 'mom', start: 0, end: 1000, color: 'blue' },
  { row: 's2', start: 0, end: 1000, color: 'red' },
  { row: 'dad', start: 0, end: 1000, color: 'red' },
]

const UNANSWERED: Block = { row: '', start: 0, end: 1000, color: 'green' }

const ROW_GROUPS: RowGroup[] = [
  { match: '^s', group: 'Kids', color: '#e41a1c' },
  { match: '^(mom|dad)$', group: 'Parents', color: '#377eb8' },
]

const REGIONS = [{ ...ctgA, end: 1000 }]

function regionData(
  blocks: Block[],
  { usedItemRgb = false, field = 'sample' } = {},
): MultiRowRegionData {
  const partitionValues = [...new Set(blocks.map(b => b.row))]
  return {
    featureStarts: Uint32Array.from(blocks.map(b => b.start)),
    featureEnds: Uint32Array.from(blocks.map(b => b.end)),
    featureColors: Uint32Array.from(blocks.map(b => cssColorToABGR(b.color))),
    featureDeltas: new Int32Array(0),
    partitionValues,
    featurePartitionIndex: Uint32Array.from(
      blocks.map(b => partitionValues.indexOf(b.row)),
    ),
    featureNames: blocks.map(b => b.row),
    featureIds: blocks.map((_, i) => `f${i}`),
    usedItemRgb,
    partitionCandidates: ['clade', 'sample'],
    partitionCandidateValues: [],
    legendCandidates: [],
    resolvedPartitionField: field,
  }
}

function loaded(
  arrangement: Arrangement,
  settings: Record<string, unknown> = {},
  data = regionData(FAMILY),
) {
  const { display } = createTestEnvironment({
    displayConfig: { ...arrangementConfig(arrangement), ...settings },
  }).createDisplay()
  display.setRpcData(0, data, ctgA)
  return display
}

function derived(display: Display) {
  return {
    sources: display.sources.map(({ name, label, group, labelColor }) => ({
      name,
      label,
      group,
      labelColor,
    })),
    editableSources: display.editableSources.map(({ name, label }) => ({
      name,
      label,
    })),
    labelSources: display.labelSources.map(({ name, labelColor }) => ({
      name,
      labelColor,
    })),
    rowColorStringsByIndex: display.rowColorStringsByIndex,
    rowGroupsScale: display.colorScales.find(s => s.id === 'rowGroups'),
    rowTree: display.rowTree,
    treeDrawn: display.hierarchy !== undefined,
    rowArrangementIsCustom: display.rowArrangementIsCustom,
  }
}

// What the worker's clustering hands back for `tree`: its leaves in the
// order it names them, indexed into the rows the run was given.
async function clusterRun(display: Display, tree: string) {
  const leaves = tree.match(/[\w]+/g)!
  await runMultiRowClustering({
    model: display,
    regions: REGIONS,
    rpcManager: {
      call: (
        _sessionId: string,
        _method: string,
        args: { sources: string[] },
      ) =>
        Promise.resolve({
          order: leaves.map(name => args.sources.indexOf(name)),
          tree,
          encoding: 'categorical',
        }),
    } as never,
    sessionId: 'test',
    signal: new AbortController().signal,
    statusCallback: () => {},
  })
}

test('the rows sort, digits by magnitude, each dealt a palette entry', () => {
  expect(derived(loaded({}))).toMatchSnapshot()
})

test('the unanswered row sorts last and is labelled for the field', () => {
  const display = loaded({}, {}, regionData([...FAMILY, UNANSWERED]))
  expect(derived(display)).toMatchSnapshot()
})

test('a declared order leads and the rest sort', () => {
  expect(derived(loaded({ domain: ['s10', 'mom'] }))).toMatchSnapshot()
})

test('a colour entry paints its row, the rest keep their palette entries', () => {
  expect(derived(loaded({ colors: { mom: '#123456' } }))).toMatchSnapshot()
})

test('a color slot turns the palette off, a colour entry still paints', () => {
  const display = loaded({ colors: { dad: '#00ff00' } }, { color: 'steelblue' })
  expect(derived(display)).toMatchSnapshot()
})

test('itemRgb turns the palette off', () => {
  const display = loaded({}, {}, regionData(FAMILY, { usedItemRgb: true }))
  expect(derived(display)).toMatchSnapshot()
})

test('rowGroups tag and partition the rows, keyed under short rows', () => {
  const display = loaded(
    {},
    { rowGroups: ROW_GROUPS, rowHeight: 4 },
    regionData([...FAMILY, UNANSWERED]),
  )
  expect(derived(display)).toMatchSnapshot()
})

test('rowGroups yield the order to a tree that describes the rows', async () => {
  const display = loaded({}, { rowGroups: ROW_GROUPS, rowHeight: 4 })
  await clusterRun(display, '((dad,s2),(mom,s10));')
  expect(derived(display)).toMatchSnapshot()
})

test('colorRowLabels carries the painted colour, a group swatch winning', () => {
  const display = loaded(
    { colors: { s2: '#123456' } },
    { colorRowLabels: true, rowGroups: [ROW_GROUPS[1]] },
  )
  expect(derived(display)).toMatchSnapshot()
})

test('a focus hides rows without recolouring the kept ones', () => {
  const display = loaded({})
  display.setRowFocus(['mom', 's10'])
  expect(derived(display)).toMatchSnapshot()
  display.setRowFocus(undefined)
  expect(display.sources.map(s => s.name)).toEqual(['dad', 'mom', 's2', 's10'])
})

test('a legend click focuses the group it names', () => {
  const display = loaded({}, { rowGroups: ROW_GROUPS, rowHeight: 4 })
  display.focusLegendEntry('rowGroups', 'Parents')
  expect(display.sources.map(s => s.name)).toEqual(['dad', 'mom'])
})

test('dialog edits reorder, relabel and recolour, and a reset returns to the seed', () => {
  const display = loaded(
    { domain: ['s10'] },
    {},
    regionData([...FAMILY, UNANSWERED]),
  )
  const [s10, dad, mom, s2, unanswered] = display.editableSources
  display.applyRowEdits([
    { ...mom!, label: 'Mother' },
    unanswered!,
    { ...s2!, color: '#0000ff' },
    dad!,
    s10!,
  ])
  expect(derived(display)).toMatchSnapshot()
  expect(display.editableSources.find(s => s.name === 's2')?.color).toBe(
    '#0000ff',
  )
  display.resetRowArrangement()
  expect(derived(display)).toMatchSnapshot()
})

test('a cluster run lands its tree turned towards the seed, and a reorder drops it', async () => {
  const display = loaded({ domain: ['s10'] })
  await clusterRun(display, '((dad,s2),(mom,s10));')
  expect(derived(display)).toMatchSnapshot()
  expect(display.rowTreeProvenance).toMatchSnapshot()

  const [first, second, ...rest] = display.editableSources
  display.setRowOrder([second!, first!, ...rest])
  expect(derived(display)).toMatchSnapshot()
})

test('sort at a column orders rows by the colour painted there', () => {
  const display = loaded({}, {}, regionData([...FAMILY, UNANSWERED]))
  expect(display.sortRowsByValueAt('ctgA', 100)).toBe(true)
  expect(derived(display)).toMatchSnapshot()
})

test('a repartition drops the arrangement keyed on the old rows', async () => {
  const display = loaded({ domain: ['s10'] })
  await clusterRun(display, '((dad,s2),(mom,s10));')
  const [a, b, ...rest] = display.editableSources
  display.applyRowEdits([
    b!,
    { ...a!, label: 'First', color: '#0000ff' },
    ...rest,
  ])
  display.setRowFocus(['dad', 'mom'])
  display.setHiddenCategories(['x'])

  display.setRowsField('clade')
  display.setRpcData(
    0,
    regionData(
      [
        { row: 'wolf', start: 0, end: 1000, color: 'red' },
        { row: 'coyote', start: 0, end: 1000, color: 'blue' },
      ],
      { field: 'clade' },
    ),
    ctgA,
  )
  expect(derived(display)).toMatchSnapshot()
  expect(display.hiddenCategories).toEqual([])
})
