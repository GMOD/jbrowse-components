import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { workCensus } from '@jbrowse/display-test-utils'

import { runMultiRowClustering } from './runMultiRowClustering.ts'
import { createTestEnvironment, ctgA, ctgB } from './testEnv.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'
import type { RowSource } from '@jbrowse/tree-sidebar'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

const ROWS = ['s10', 'mom', 's2', 'dad']

function regionData(): MultiRowRegionData {
  return {
    featureStarts: Uint32Array.from(ROWS.map(() => 0)),
    featureEnds: Uint32Array.from(ROWS.map(() => 1000)),
    featureColors: Uint32Array.from(ROWS.map(() => cssColorToABGR('red'))),
    featureDeltas: new Int32Array(0),
    partitionValues: ROWS,
    featurePartitionIndex: Uint32Array.from(ROWS.map((_, i) => i)),
    featureNames: ROWS,
    featureIds: ROWS.map((_, i) => `f${i}`),
    usedItemRgb: false,
    partitionCandidates: ['sample'],
    partitionCandidateValues: [],
    legendCandidates: [],
    resolvedPartitionField: 'sample',
  }
}

const REGIONS = [
  { ...ctgA, end: 10_000 },
  { ...ctgB, end: 10_000 },
]

test('what each row step recomputes', async () => {
  const { display, view } = createTestEnvironment({
    displayConfig: { rows: 'sample' },
  }).createDisplay(REGIONS)
  const firstEdited = (edit: Partial<RowSource>) => {
    const [first, ...rest] = display.editableSources
    return [{ ...first!, ...edit }, ...rest]
  }
  const table = await workCensus(display, [
    {
      name: 'initial load',
      run: () => {
        display.setRpcData(0, regionData(), REGIONS[0]!)
      },
    },
    {
      name: 'second region arrival',
      run: () => {
        display.setRpcData(1, regionData(), REGIONS[1]!)
      },
    },
    {
      name: 'pan, no arrival',
      run: () => {
        view.horizontalScroll(100)
      },
    },
    {
      name: 'drag reorder',
      run: () => {
        const [a, b, ...rest] = display.editableSources
        display.setRowOrder([b!, a!, ...rest])
      },
    },
    {
      name: 'focus',
      run: () => {
        display.setRowFocus(['dad', 'mom', 's2'])
      },
    },
    {
      name: 'relabel',
      run: () => {
        display.applyRowEdits(firstEdited({ label: 'Renamed' }))
      },
    },
    {
      name: 'recolour',
      run: () => {
        display.applyRowEdits(firstEdited({ color: '#123456' }))
      },
    },
    {
      name: 'cluster run lands a tree',
      run: () =>
        runMultiRowClustering({
          model: display,
          regions: [REGIONS[0]!],
          rpcManager: {
            call: async (
              _sessionId: string,
              _method: string,
              { sources }: { sources: string[] },
            ) => ({
              order: ['mom', 's2', 'dad'].map(name => sources.indexOf(name)),
              tree: '((mom,s2),dad);',
              encoding: 'categorical',
            }),
          } as never,
          sessionId: 'census',
          signal: new AbortController().signal,
          statusCallback: () => {},
        }),
    },
    {
      name: 'region arrival, arranged',
      run: () => {
        display.setRpcData(0, regionData(), REGIONS[0]!)
      },
    },
    {
      name: 'reset',
      run: () => {
        display.resetRowArrangement()
      },
    },
  ])
  expect(display.rowTree).toBeUndefined()
  expect(table).toMatchSnapshot()
})
