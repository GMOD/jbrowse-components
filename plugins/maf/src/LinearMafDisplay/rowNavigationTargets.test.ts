import { testWireRegionData } from '../LinearMafGetAlignmentDataRpc/mafWire.fixture.ts'
import { emptyMafCoverage } from './components/coverageTestFixture.ts'
import { rowNavigationTargetsOf } from './rowNavigationTargets.ts'
import { createMafTestEnvironment, stageDetailRegion } from './testEnv.ts'

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
        srcRefName: `chr${rowIndex}`,
        srcStart: 500,
        strand: 1,
      })),
      empties: [],
    },
  ],
}

const sources: MafSource[] = [
  { name: 'hg38', label: 'Human' },
  {
    name: 'mm10',
    label: 'mm10',
    assemblyName: 'mouse',
    assemblyConfigLocation: {
      uri: 'mouse/config.json',
      locationType: 'UriLocation',
    },
  },
  { name: 'rn6', label: 'rn6' },
]

function targets(
  overrides: Partial<Parameters<typeof rowNavigationTargetsOf>[0]> = {},
) {
  return rowNavigationTargetsOf({
    sources,
    assemblies: {
      has: name => name === 'hg38',
      getCanonicalAssemblyName: name => (name === 'hg38' ? name : undefined),
    },
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
    refName: 'chr0',
    start: 501,
    end: 504,
    sampleLabel: 'Human',
  })
})

test('an assemblyName the session lacks, with no config to load it from, is no target', () => {
  const unloadable: MafSource = {
    name: 'mm10',
    label: 'mm10',
    assemblyName: 'mouse',
  }
  expect(
    targets({ sources: [sources[0]!, unloadable] }).map(t => t.rowIndex),
  ).toEqual([0])
  expect(
    targets({
      sources: [sources[0]!, unloadable],
      assemblies: { has: () => true, getCanonicalAssemblyName: name => name },
    }).map(t => t.assemblyName),
  ).toEqual(['hg38', 'mouse'])
})

test('only the requested rows are asked about', () => {
  expect(targets({ startRow: 1, endRow: 2 }).map(t => t.rowIndex)).toEqual([1])
})

test('no fetched region for the display means no targets', () => {
  expect(targets({ detail: new Map() })).toEqual([])
})

test('no row naming a loaded assembly means no targets', () => {
  expect(
    targets({
      assemblies: {
        has: () => false,
        getCanonicalAssemblyName: () => undefined,
      },
      sources: [sources[2]!],
    }),
  ).toEqual([])
})

// A row named by an assembly alias (the HPRC summary's `GRCh38` under hg38)
// opens its view and keys its synteny track under the canonical name.
test('a row named by an alias targets the canonical assembly', () => {
  const { display } = createMafTestEnvironment({
    assemblyAliases: { vvx: 'volvox' },
  }).createDisplay()
  display.setSamples({
    samples: [{ name: 'vvx', label: 'Volvox' }],
    treeNewick: undefined,
    samplesCanonical: true,
  })
  stageDetailRegion(
    display,
    0,
    testWireRegionData(
      [
        {
          startBp: 100,
          refSeq: 'ACGTA',
          rows: [{ sampleId: 'vvx', seq: 'ACGTA', srcRefName: 'ctgA' }],
        },
      ],
      { coverage: emptyMafCoverage(100) },
    ),
  )
  expect(
    display.rowNavigationTargets(0, 101, 104, 0, 1).map(t => t.assemblyName),
  ).toEqual(['volvox'])
})
