import { workCensus } from '@jbrowse/display-test-utils'

import { runWiggleClustering } from './runWiggleClustering.ts'
import { createTestEnvironment, makeMultiWiggleData } from './testEnv.ts'

import type { Source } from '../util.ts'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

const NAMES = ['Grain1', 'Grain2', 'Grain3', 'Grain4']

const ctgB = { refName: 'ctgB', start: 0, end: 10_000, assemblyName: 'volvox' }

// The gate on the row pipeline's work: a count that rises is a regression the
// commit changing this snapshot explains.
test('what each row step recomputes', async () => {
  const { createDisplay } = createTestEnvironment({
    displayConfig: { rows: 'source', defaultRendering: 'line' },
  })
  const { display, view } = createDisplay()
  const firstEdited = (edit: Partial<Source>) => {
    const [first, ...rest] = display.editableSources
    return [{ ...first!, ...edit }, ...rest]
  }
  const table = await workCensus(display, [
    {
      name: 'initial load',
      run: () => {
        display.setRpcData(
          0,
          makeMultiWiggleData(...NAMES)[0]!,
          view.displayedRegions[0],
        )
      },
    },
    {
      name: 'second region arrival',
      run: () => {
        display.setRpcData(1, makeMultiWiggleData(...NAMES)[0]!, ctgB)
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
        display.setRowFocus(NAMES.slice(0, 3))
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
        runWiggleClustering({
          model: display,
          rpcManager: {
            call: async () => ({
              order: [0, 2, 1],
              tree: '((Grain2,Grain3),Grain1);',
            }),
          },
          sessionId: 'census',
          samplesPerPixel: '1',
          regions: [view.displayedRegions[0]!],
          signal: new AbortController().signal,
          statusCallback: () => {},
        }),
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
