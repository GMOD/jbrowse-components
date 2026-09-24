import { workCensus } from '@jbrowse/display-test-utils'

import { createTestEnvironment } from '../LinearMultiSampleVariantDisplay/testEnv.ts'
import { runGenotypeClustering } from './runGenotypeClustering.ts'

import type { LinearMultiSampleVariantDisplayModel } from '../LinearMultiSampleVariantDisplay/model.ts'
import type { ProcessedSource } from './types.ts'

type Display = LinearMultiSampleVariantDisplayModel

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

const SOURCES = [
  { name: 'S0', population: 'AFR', color: '#aa0000', label: 'Sample zero' },
  { name: 'S1', population: 'EUR' },
  { name: 'S2', population: 'AFR', color: '#00aa00' },
  { name: 'S3', population: 'EAS', label: 'Sample three' },
]

const SAMPLE_INFO = {
  S0: { isPhased: true, maxPloidy: 2 },
  S1: { isPhased: true, maxPloidy: 2 },
  S2: { isPhased: true, maxPloidy: 2 },
  S3: { isPhased: true, maxPloidy: 1 },
}

const GENOTYPES = {
  v500: ['0|1', '1|1', '0|0', '1'],
  v700: ['1|0', '0|0', '1|1', '0'],
}

// A fetch's payload, and a fresh `sampleInfo` with it, as every arrival brings
function landCells(display: Display, regionIndex: number) {
  const genotypeDict = [...new Set(Object.values(GENOTYPES).flat())]
  const codes = (gts: string[]) =>
    new Uint32Array(gts.map(g => genotypeDict.indexOf(g) + 1))
  display.setCellData(
    {
      mode: 'regular',
      sampleNames: SOURCES.map(s => s.name),
      genotypeDict,
      sampleInfo: structuredClone(SAMPLE_INFO),
      rowNames: [],
      simplifiedFeatures: Object.keys(GENOTYPES).map(id => ({
        id,
        data: { start: Number(id.slice(1)), end: Number(id.slice(1)) + 1 },
      })),
      perRegionCellData: {
        [regionIndex]: {
          featureGenotypeMap: Object.fromEntries(
            Object.entries(GENOTYPES).map(([id, gts]) => [
              id,
              { genotypeCodes: codes(gts) },
            ]),
          ),
        },
      },
    } as unknown as Parameters<Display['setCellData']>[0],
    [regionIndex],
  )
}

// Phased, since that is where a row answers to its sample through `rowAlias`
// and an arrival's ploidy re-expands the rows: the path today's 1.7x
// arrangement regression lived on, per row inside one arranger run.
test('what each row step recomputes, phased', async () => {
  const { display, view } = createTestEnvironment({
    displayConfig: { renderingMode: 'phased' },
  }).createDisplay()
  const firstEdited = (edit: Partial<ProcessedSource>) => {
    const [first, ...rest] = display.editableSources
    return [{ ...first!, ...edit }, ...rest]
  }
  const table = await workCensus(display, [
    {
      name: 'initial load',
      run: () => {
        display.setSources(SOURCES)
        landCells(display, 0)
      },
    },
    {
      name: 'second region arrival',
      run: () => {
        landCells(display, 1)
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
        display.setRowFocus(['S0', 'S2'])
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
        runGenotypeClustering({
          model: display,
          rpcManager: {
            call: async () => ({
              order: [2, 3, 0, 1],
              tree: '((S2 HP0,S2 HP1),(S0 HP0,S0 HP1));',
            }),
          },
          sessionId: 'census',
          regions: [view.displayedRegions[0]!],
          signal: new AbortController().signal,
          statusCallback: () => {},
        }),
    },
    {
      name: 'region arrival, arranged',
      run: () => {
        landCells(display, 0)
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
