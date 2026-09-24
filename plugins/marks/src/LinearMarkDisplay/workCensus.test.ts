import { workCensus } from '@jbrowse/display-test-utils'

import { runMarkClustering } from './runMarkClustering.ts'
import {
  REGION,
  createTestEnvironment,
  features,
  workerResult,
} from './testEnv.ts'

import type { RowSource } from '@jbrowse/tree-sidebar'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

const REGIONS = [REGION, { ...REGION, refName: 'ctgB' }]

const FEATURES = features(
  ['s10', 'mom', 's2', 'dad'].map((source, i) => ({
    source,
    start: i * 100,
    end: i * 100 + 50,
    score: i + 1,
  })),
)

test('what each row step recomputes', async () => {
  const { display, view } = createTestEnvironment(
    {
      rows: 'source',
      marks: [{ mark: 'bar', encoding: { y: 'score' } }],
    },
    REGIONS,
  ).createDisplay()
  const firstEdited = (edit: Partial<RowSource>) => {
    const [first, ...rest] = display.editableSources
    return [{ ...first!, ...edit }, ...rest]
  }
  const table = await workCensus(display, [
    {
      name: 'initial load',
      run: () => {
        display.setRpcData(0, workerResult(display, FEATURES), REGIONS[0]!)
      },
    },
    {
      name: 'second region arrival',
      run: () => {
        display.setRpcData(1, workerResult(display, FEATURES), REGIONS[1]!)
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
        display.applyRowEdits(firstEdited({ labelColor: '#123456' }))
      },
    },
    {
      name: 'cluster run lands a tree',
      run: () =>
        runMarkClustering({
          model: display,
          regions: [REGIONS[0]!],
          rpcManager: {
            call: async (_sessionId, _method, { rows }) => ({
              order: ['mom', 's2', 'dad'].map(name => rows.indexOf(name)),
              tree: '((mom,s2),dad);',
            }),
          },
          sessionId: 'census',
          signal: new AbortController().signal,
          statusCallback: () => {},
        }),
    },
    {
      name: 'region arrival, arranged',
      run: () => {
        display.setRpcData(0, workerResult(display, FEATURES), REGIONS[0]!)
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
