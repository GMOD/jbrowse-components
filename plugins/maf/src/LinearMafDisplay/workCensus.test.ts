import { workCensus } from '@jbrowse/display-test-utils'

import { testWireRegionData } from '../LinearMafGetAlignmentDataRpc/testWire.ts'
import { emptyMafCoverage } from './components/coverageTestFixture.ts'
import { runMafClustering } from './runMafClustering.ts'
import { createMafTestEnvironment, stageDetailRegion } from './testEnv.ts'

import type { LinearMafDisplayModel, MafSource } from './stateModel.ts'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

const SAMPLES = [
  { id: 'hg38', label: 'Human', color: '#aa0000' },
  { id: 'panTro4', label: 'Chimp' },
  { id: 'mm10', label: 'Mouse', color: '#0000aa' },
  { id: 'rn6', label: 'Rat' },
]

const REGIONS = [
  { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 5000 },
  { assemblyName: 'volvox', refName: 'ctgA', start: 5000, end: 10_000 },
]

// A detail fetch's commit: the batch's sample set, then the region's rows
function arrive(display: LinearMafDisplayModel, index: number) {
  display.setSamples({
    samples: SAMPLES,
    treeNewick: undefined,
    samplesCanonical: true,
  })
  const startBp = REGIONS[index]!.start + 100
  stageDetailRegion(
    display,
    index,
    testWireRegionData(
      [
        {
          startBp,
          refSeq: 'ACGT',
          rows: SAMPLES.map(({ id }) => ({ sampleId: id, seq: 'ACGT' })),
        },
      ],
      { coverage: emptyMafCoverage(startBp), refSampleId: 'hg38' },
    ),
  )
}

test('what each row step recomputes', async () => {
  const { display, view } = createMafTestEnvironment().createDisplay({
    regions: REGIONS,
  })
  const firstEdited = (edit: Partial<MafSource>) => {
    const [first, ...rest] = display.editableSources
    return [{ ...first!, ...edit }, ...rest]
  }
  const table = await workCensus(display, [
    {
      name: 'initial load',
      run: () => {
        arrive(display, 0)
      },
    },
    {
      name: 'second region arrival',
      run: () => {
        arrive(display, 1)
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
        display.setRowFocus(['hg38', 'panTro4', 'mm10'])
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
        runMafClustering({
          model: display,
          rpcManager: {
            call: async (
              _sessionId: string,
              _method: string,
              { sources }: { sources: string[] },
            ) => ({
              order: ['mm10', 'hg38', 'panTro4'].map(n => sources.indexOf(n)),
              tree: '(mm10,(hg38,panTro4));',
            }),
          },
          sessionId: 'census',
          regions: [REGIONS[0]!],
          signal: new AbortController().signal,
          statusCallback: () => {},
        }),
    },
    {
      name: 'region arrival, arranged',
      run: () => {
        arrive(display, 0)
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
