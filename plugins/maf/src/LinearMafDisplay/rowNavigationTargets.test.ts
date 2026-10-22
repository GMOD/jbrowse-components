import { emptyMafCoverage } from './components/coverageTestFixture.ts'
import { rowNavigationTargetsOf } from './rowNavigationTargets.ts'

import type { MafRegionData } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafSource } from '../types.ts'

const enc = new TextEncoder()

const region: MafRegionData = {
  coverage: emptyMafCoverage(),
  blocks: [
    {
      startBp: 100,
      endBp: 105,
      refSeqBytes: enc.encode('AAAAA'),
      rows: [0, 1, 2].map(rowIndex => ({
        rowIndex,
        alignmentBytes: enc.encode('acgta'),
        chr: `chr${rowIndex}`,
        srcStart: 500,
        strand: 1,
      })),
      empties: [],
    },
  ],
}

const sources: MafSource[] = [
  { name: 'hg38', label: 'Human' },
  { name: 'mm10', label: 'mm10', assemblyName: 'mouse' },
  { name: 'rn6', label: 'rn6' },
]

function targets(
  overrides: Partial<Parameters<typeof rowNavigationTargetsOf>[0]> = {},
) {
  return rowNavigationTargetsOf({
    sources,
    hasAssembly: name => name === 'hg38',
    detail: new Map([[0, region]]),
    displayedRegionIndex: 0,
    startBp: 101,
    endBp: 104,
    startRow: 0,
    endRow: 3,
    ...overrides,
  })
}

test('a row navigates under its assemblyName, else a sample id that is an assembly', () => {
  expect(targets().map(t => [t.rowIndex, t.assemblyName])).toEqual([
    [0, 'hg38'],
    [1, 'mouse'],
  ])
})

test('a target carries the span in its own genome and the sample label', () => {
  expect(targets()[0]).toMatchObject({
    rowIndex: 0,
    chr: 'chr0',
    start: 501,
    end: 504,
    sampleLabel: 'Human',
  })
})

test('only the requested rows are asked about', () => {
  expect(targets({ startRow: 1, endRow: 2 }).map(t => t.rowIndex)).toEqual([1])
})

test('no fetched region for the display means no targets', () => {
  expect(targets({ detail: new Map() })).toEqual([])
})

test('no row naming a loaded assembly means no targets', () => {
  expect(targets({ hasAssembly: () => false, sources: [sources[2]!] })).toEqual(
    [],
  )
})
