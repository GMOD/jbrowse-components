import {
  computeInsertionIndicators,
  computeSNPCoverage,
  extractIndelsFromCs,
  extractMismatchesFromCs,
} from '@jbrowse/alignments-core'
import { computeCoverage } from '@jbrowse/plugin-alignments'

import {
  getGlobalMaxDepth,
  mergeGenomeRows,
} from '../LinearSyntenyRPC/syntenyRegionTypes.ts'

import type { SyntenyRegionData } from '../LinearSyntenyRPC/syntenyRegionTypes.ts'
import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'

function feat(overrides: Partial<MultiPairFeature> = {}): MultiPairFeature {
  return {
    queryGenome: 'genomeA',
    origRefName: 'chr1',
    start: 1000,
    end: 2000,
    mateStart: 500,
    mateEnd: 1500,
    mateRefName: 'chr1',
    strand: 1,
    syriType: undefined,
    identity: 0.99,
    featureId: 'f1',
    segmentId: undefined,
    cigar: undefined,
    cs: undefined,
    ...overrides,
  }
}

function buildRegionData(
  region: { start: number; end: number; refName?: string },
  features: MultiPairFeature[],
): SyntenyRegionData {
  const regionStart = Math.floor(region.start)
  const regionEnd = Math.ceil(region.end)
  const coverageFeatures = features.map(f => ({ start: f.start, end: f.end }))
  const mismatches: { position: number; base: number; strand: number }[] = []
  const indels: { position: number; type: 1 | 2; length: number }[] = []
  for (const f of features) {
    if (f.cs) {
      extractMismatchesFromCs(f.cs, f.start, mismatches)
      extractIndelsFromCs(f.cs, f.start, indels)
    }
  }
  const coverage = computeCoverage(coverageFeatures, [], regionStart, regionEnd)
  const snp = computeSNPCoverage(mismatches, coverage.maxDepth, regionStart)
  const indicators = computeInsertionIndicators(
    indels,
    coverage.depths,
    coverage.startOffset,
    regionStart,
  )
  const mismatchPositions = new Uint32Array(mismatches.length)
  const mismatchBases = new Uint8Array(mismatches.length)
  for (let i = 0; i < mismatches.length; i++) {
    mismatchPositions[i] = mismatches[i]!.position - regionStart
    mismatchBases[i] = mismatches[i]!.base
  }
  return {
    refName: region.refName ?? 'chr1',
    regionStart,
    genomeFeatures: [['genomeA', features]],
    coverageDepths: coverage.depths,
    coverageMaxDepth: coverage.maxDepth,
    coverageStartOffset: coverage.startOffset,
    snpPositions: snp.positions,
    snpYOffsets: snp.yOffsets,
    snpHeights: snp.heights,
    snpColorTypes: snp.colorTypes,
    snpCount: snp.count,
    mismatchPositions,
    mismatchBases,
    numMismatches: mismatches.length,
    indicatorPositions: indicators.positions,
    numIndicators: indicators.count,
  }
}

describe('collapsed intron view: same refName, different regions', () => {
  const regionA = {
    assemblyName: 'hg38',
    refName: 'chr1',
    start: 1000,
    end: 3000,
  }
  const regionB = {
    assemblyName: 'hg38',
    refName: 'chr1',
    start: 8000,
    end: 10000,
  }

  test('each region gets independent coverage data', () => {
    const featuresA = [
      feat({ start: 1000, end: 2000 }),
      feat({ start: 1500, end: 2500 }),
    ]
    const featuresB = [feat({ start: 8000, end: 9000 })]

    const dataA = buildRegionData(regionA, featuresA)
    const dataB = buildRegionData(regionB, featuresB)

    // Region A has two overlapping features: max depth should be 2
    expect(dataA.coverageMaxDepth).toBe(2)
    // Region B has one feature: max depth should be 1
    expect(dataB.coverageMaxDepth).toBe(1)

    // Store under different keys
    const rpcDataMap = new Map<number, SyntenyRegionData>([
      [0, dataA],
      [1, dataB],
    ])
    expect(rpcDataMap.size).toBe(2)
  })
})

describe('displayedRegionIndex round-trip: fetch stores and render looks up by number', () => {
  test('data stored by displayedRegionIndex is retrievable', () => {
    const displayedRegions = [
      { assemblyName: 'hg38', refName: 'chr1', start: 0, end: 248956422 },
      { assemblyName: 'hg38', refName: 'chr2', start: 0, end: 242193529 },
    ]

    const rpcDataMap = new Map<number, SyntenyRegionData>()
    for (let i = 0; i < displayedRegions.length; i++) {
      const region = displayedRegions[i]!
      rpcDataMap.set(
        i,
        buildRegionData(region, [
          feat({ start: region.start + 100, end: region.start + 200 }),
        ]),
      )
    }

    for (
      let displayedRegionIndex = 0;
      displayedRegionIndex < displayedRegions.length;
      displayedRegionIndex++
    ) {
      const data = rpcDataMap.get(displayedRegionIndex)
      expect(data).toBeDefined()
    }
  })
})

describe('genomeRows aggregation across regions', () => {
  test('merges features from multiple rpcDataMap entries', () => {
    const rpcDataMap = new Map<number, SyntenyRegionData>([
      [
        0,
        buildRegionData({ start: 0, end: 1000 }, [
          feat({ start: 100, end: 200 }),
        ]),
      ],
      [
        1,
        buildRegionData({ start: 5000, end: 6000 }, [
          feat({ start: 5100, end: 5200 }),
        ]),
      ],
    ])

    const merged = mergeGenomeRows(rpcDataMap)

    expect(merged.get('genomeA')?.length).toBe(2)
    expect(merged.get('genomeA')![0]!.start).toBe(100)
    expect(merged.get('genomeA')![1]!.start).toBe(5100)
  })

  test('multiple genomes are preserved separately', () => {
    const rpcDataMap = new Map<number, SyntenyRegionData>([
      [
        0,
        {
          refName: 'chr1',
          regionStart: 0,
          genomeFeatures: [
            [
              'genomeA',
              [feat({ queryGenome: 'genomeA', start: 100, end: 200 })],
            ],
            [
              'genomeB',
              [feat({ queryGenome: 'genomeB', start: 300, end: 400 })],
            ],
          ],
          coverageDepths: new Float32Array(0),
          coverageMaxDepth: 0,
          coverageStartOffset: 0,
          snpPositions: new Uint32Array(0),
          snpYOffsets: new Float32Array(0),
          snpHeights: new Float32Array(0),
          snpColorTypes: new Uint8Array(0),
          snpCount: 0,
          mismatchPositions: new Uint32Array(0),
          mismatchBases: new Uint8Array(0),
          numMismatches: 0,
          indicatorPositions: new Uint32Array(0),
          numIndicators: 0,
        },
      ],
    ])

    const merged = mergeGenomeRows(rpcDataMap)

    expect(merged.size).toBe(2)
    expect(merged.get('genomeA')?.length).toBe(1)
    expect(merged.get('genomeB')?.length).toBe(1)
  })
})

describe('coverage correctness for overlapping synteny features', () => {
  test('non-overlapping features produce depth 1', () => {
    const features = [
      feat({ start: 100, end: 200 }),
      feat({ start: 300, end: 400 }),
    ]
    const data = buildRegionData({ start: 0, end: 500 }, features)
    expect(data.coverageMaxDepth).toBe(1)

    // Check actual depths at specific positions
    const depthAt150 =
      data.coverageDepths[150 - data.regionStart - data.coverageStartOffset]
    const depthAt250 =
      data.coverageDepths[250 - data.regionStart - data.coverageStartOffset]
    expect(depthAt150).toBe(1)
    // Gap between features should be 0
    expect(depthAt250).toBe(0)
  })

  test('overlapping features accumulate depth', () => {
    const features = [
      feat({ start: 100, end: 300 }),
      feat({ start: 200, end: 400 }),
      feat({ start: 250, end: 350 }),
    ]
    const data = buildRegionData({ start: 0, end: 500 }, features)
    expect(data.coverageMaxDepth).toBe(3)

    // At position 275, all three features overlap
    const idx275 = 275 - data.regionStart - data.coverageStartOffset
    expect(data.coverageDepths[idx275]).toBe(3)

    // At position 150, only the first feature
    const idx150 = 150 - data.regionStart - data.coverageStartOffset
    expect(idx150).toBeGreaterThanOrEqual(0)
    expect(data.coverageDepths[idx150]).toBe(1)
  })

  test('empty region produces zero coverage', () => {
    const data = buildRegionData({ start: 0, end: 1000 }, [])
    expect(data.coverageMaxDepth).toBe(0)
  })
})

describe('getGlobalMaxDepth', () => {
  test('returns max across all regions', () => {
    const rpcDataMap = new Map<number, SyntenyRegionData>([
      [
        0,
        buildRegionData({ start: 0, end: 100 }, [feat({ start: 10, end: 50 })]),
      ],
      [
        1,
        buildRegionData({ start: 0, end: 100 }, [
          feat({ start: 10, end: 50 }),
          feat({ start: 20, end: 40 }),
        ]),
      ],
    ])
    expect(getGlobalMaxDepth(rpcDataMap)).toBe(2)
  })

  test('returns 0 for empty map', () => {
    expect(getGlobalMaxDepth(new Map())).toBe(0)
  })
})

describe('SNP coverage from CS tags', () => {
  test('extractMismatchesFromCs produces mismatch entries', () => {
    const mismatches: { position: number; base: number; strand: number }[] = []
    extractMismatchesFromCs(':5*ag:3', 100, mismatches)
    expect(mismatches.length).toBe(1)
    expect(mismatches[0]!.position).toBe(105)
    expect(String.fromCharCode(mismatches[0]!.base)).toBe('G')
  })

  test('computeSNPCoverage produces stacked segments', () => {
    const mismatches: { position: number; base: number; strand: number }[] = []
    extractMismatchesFromCs(':5*ag*ct:3', 0, mismatches)
    const result = computeSNPCoverage(mismatches, 10, 0)
    expect(result.count).toBeGreaterThan(0)
    expect(result.positions.length).toBe(result.count)
    expect(result.colorTypes.length).toBe(result.count)
  })

  test('SyntenyRegionData with CS features has mismatch data', () => {
    const features = [feat({ start: 100, end: 110, cs: ':3*ag:3*ct:2' })]
    const region = { start: 0, end: 200 }
    const regionStart = Math.floor(region.start)
    const regionEnd = Math.ceil(region.end)
    const coverageFeatures = features.map(f => ({ start: f.start, end: f.end }))
    const mismatches: { position: number; base: number; strand: number }[] = []
    for (const f of features) {
      if (f.cs) {
        extractMismatchesFromCs(f.cs, f.start, mismatches)
      }
    }
    const coverage = computeCoverage(
      coverageFeatures,
      [],
      regionStart,
      regionEnd,
    )
    const snp = computeSNPCoverage(mismatches, coverage.maxDepth, regionStart)

    expect(mismatches.length).toBe(2)
    expect(snp.count).toBe(2)
  })
})

describe('multi-region coverage rendering data', () => {
  test('all regions are available for Canvas2D rendering', () => {
    const rpcDataMap = new Map<number, SyntenyRegionData>([
      [
        0,
        buildRegionData({ start: 0, end: 100, refName: 'chr1' }, [
          feat({ start: 10, end: 50 }),
        ]),
      ],
      [
        1,
        buildRegionData({ start: 0, end: 100, refName: 'chr2' }, [
          feat({ start: 20, end: 60 }),
        ]),
      ],
      [
        2,
        buildRegionData({ start: 0, end: 100, refName: 'chr3' }, [
          feat({ start: 30, end: 70 }),
        ]),
      ],
    ])
    const coverageRegions = [...rpcDataMap.values()]
    expect(coverageRegions.length).toBe(3)
    expect(coverageRegions[0]!.refName).toBe('chr1')
    expect(coverageRegions[1]!.refName).toBe('chr2')
    expect(coverageRegions[2]!.refName).toBe('chr3')
    for (const region of coverageRegions) {
      expect(region.coverageMaxDepth).toBe(1)
    }
  })

  test('SyntenyRegionData satisfies CoverageRegion interface', () => {
    const data = buildRegionData({ start: 100, end: 200 }, [
      feat({ start: 120, end: 180 }),
    ])
    expect(data.coverageDepths).toBeInstanceOf(Float32Array)
    expect(typeof data.coverageStartOffset).toBe('number')
    expect(typeof data.regionStart).toBe('number')
  })
})

describe('rendering parity: Canvas2D and GPU paths use same data', () => {
  test('coverage data is identical for both rendering paths', () => {
    const features = [
      feat({ start: 100, end: 300, cs: ':50*ag:50*ct:99' }),
      feat({ start: 200, end: 400 }),
    ]
    const data = buildRegionData({ start: 0, end: 500 }, features)

    expect(data.coverageMaxDepth).toBeGreaterThan(0)
    expect(data.coverageDepths.length).toBeGreaterThan(0)

    expect(data.snpCount).toBeGreaterThan(0)
    expect(data.snpPositions.length).toBe(data.snpCount)
    expect(data.snpColorTypes.length).toBe(data.snpCount)
    expect(data.snpHeights.length).toBe(data.snpCount)

    expect(data.numMismatches).toBeGreaterThan(0)
    expect(data.mismatchPositions.length).toBe(data.numMismatches)
    expect(data.mismatchBases.length).toBe(data.numMismatches)
  })

  test('mismatch arrays match SNP coverage segments', () => {
    const features = [feat({ start: 100, end: 110, cs: ':3*ag:6' })]
    const region = { start: 0, end: 200 }
    const regionStart = Math.floor(region.start)
    const regionEnd = Math.ceil(region.end)
    const coverageFeatures = features.map(f => ({ start: f.start, end: f.end }))
    const mismatches: { position: number; base: number; strand: number }[] = []
    for (const f of features) {
      if (f.cs) {
        extractMismatchesFromCs(f.cs, f.start, mismatches)
      }
    }
    const coverage = computeCoverage(
      coverageFeatures,
      [],
      regionStart,
      regionEnd,
    )
    const snp = computeSNPCoverage(mismatches, coverage.maxDepth, regionStart)

    expect(mismatches.length).toBe(1)
    expect(snp.count).toBe(1)
    expect(snp.positions[0]).toBe(mismatches[0]!.position)
  })
})
