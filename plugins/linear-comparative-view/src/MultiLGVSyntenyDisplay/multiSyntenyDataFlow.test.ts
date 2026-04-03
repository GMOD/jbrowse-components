import { makeDisplayedRegionKey } from '@jbrowse/core/util/blockTypes'
import { computeCoverage } from '@jbrowse/plugin-alignments'

import { getFirstCoverage, mergeGenomeRows } from '../LinearSyntenyRPC/syntenyRegionTypes.ts'

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
  region: { start: number; end: number },
  features: MultiPairFeature[],
): SyntenyRegionData {
  const regionStart = Math.floor(region.start)
  const regionEnd = Math.ceil(region.end)
  const coverageFeatures = features.map(f => ({ start: f.start, end: f.end }))
  const coverage = computeCoverage(coverageFeatures, [], regionStart, regionEnd)
  return {
    regionStart,
    genomeFeatures: [['genomeA', features]],
    coverageDepths: coverage.depths,
    coverageMaxDepth: coverage.maxDepth,
    coverageStartOffset: coverage.startOffset,
  }
}

describe('collapsed intron view: same refName, different regions', () => {
  // This was the original bug: two chr1 fragments would collide under
  // refName keying. With displayedRegionKey, each gets its own entry.
  const regionA = { assemblyName: 'hg38', refName: 'chr1', start: 1000, end: 3000 }
  const regionB = { assemblyName: 'hg38', refName: 'chr1', start: 8000, end: 10000 }

  test('produces different displayedRegionKeys for same refName', () => {
    const keyA = makeDisplayedRegionKey(regionA)
    const keyB = makeDisplayedRegionKey(regionB)
    expect(keyA).not.toBe(keyB)
    expect(keyA).toContain('chr1')
    expect(keyB).toContain('chr1')
  })

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
    const rpcDataMap = new Map<string, SyntenyRegionData>([
      [makeDisplayedRegionKey(regionA), dataA],
      [makeDisplayedRegionKey(regionB), dataB],
    ])
    expect(rpcDataMap.size).toBe(2)
  })
})

describe('displayedRegionKey round-trip: fetch key matches render lookup', () => {
  // The fetch path computes makeDisplayedRegionKey(displayedRegion) and stores
  // data under it. The render path computes the same key from the same
  // displayedRegion for a block with that regionNumber. They must match.
  test('key from displayed region matches key used for lookup', () => {
    const displayedRegions = [
      { assemblyName: 'hg38', refName: 'chr1', start: 0, end: 248956422 },
      { assemblyName: 'hg38', refName: 'chr2', start: 0, end: 242193529 },
    ]

    // Simulate fetch: store data under displayedRegionKey
    const rpcDataMap = new Map<string, SyntenyRegionData>()
    for (const region of displayedRegions) {
      const key = makeDisplayedRegionKey(region)
      rpcDataMap.set(key, buildRegionData(region, [feat({ start: region.start + 100, end: region.start + 200 })]))
    }

    // Simulate render: look up by regionNumber → displayedRegion → key
    for (let regionNumber = 0; regionNumber < displayedRegions.length; regionNumber++) {
      const displayedRegion = displayedRegions[regionNumber]!
      const lookupKey = makeDisplayedRegionKey(displayedRegion)
      const data = rpcDataMap.get(lookupKey)
      expect(data).toBeDefined()
    }
  })

  test('reversed region produces distinct key from non-reversed', () => {
    const fwd = { assemblyName: 'hg38', refName: 'chr1', start: 0, end: 1000 }
    const rev = { assemblyName: 'hg38', refName: 'chr1', start: 0, end: 1000, reversed: true }
    expect(makeDisplayedRegionKey(fwd)).not.toBe(makeDisplayedRegionKey(rev))
  })
})

describe('genomeRows aggregation across regions', () => {
  test('merges features from multiple rpcDataMap entries', () => {
    const rpcDataMap = new Map<string, SyntenyRegionData>([
      ['region1', buildRegionData({ start: 0, end: 1000 }, [
        feat({ start: 100, end: 200 }),
      ])],
      ['region2', buildRegionData({ start: 5000, end: 6000 }, [
        feat({ start: 5100, end: 5200 }),
      ])],
    ])

    const merged = mergeGenomeRows(rpcDataMap)

    expect(merged.get('genomeA')?.length).toBe(2)
    expect(merged.get('genomeA')![0]!.start).toBe(100)
    expect(merged.get('genomeA')![1]!.start).toBe(5100)
  })

  test('multiple genomes are preserved separately', () => {
    const rpcDataMap = new Map<string, SyntenyRegionData>([
      ['region1', {
        regionStart: 0,
        genomeFeatures: [
          ['genomeA', [feat({ queryGenome: 'genomeA', start: 100, end: 200 })]],
          ['genomeB', [feat({ queryGenome: 'genomeB', start: 300, end: 400 })]],
        ],
        coverageDepths: new Float32Array(0),
        coverageMaxDepth: 0,
        coverageStartOffset: 0,
      }],
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
    const depthAt150 = data.coverageDepths[150 - data.regionStart - data.coverageStartOffset]
    const depthAt250 = data.coverageDepths[250 - data.regionStart - data.coverageStartOffset]
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

describe('getFirstCoverage', () => {
  test('returns undefined for empty map', () => {
    expect(getFirstCoverage(new Map())).toBeUndefined()
  })

  test('returns undefined when all regions have zero depth', () => {
    const rpcDataMap = new Map<string, SyntenyRegionData>([
      ['r1', buildRegionData({ start: 0, end: 100 }, [])],
    ])
    expect(getFirstCoverage(rpcDataMap)).toBeUndefined()
  })

  test('returns first region with non-zero coverage', () => {
    const rpcDataMap = new Map<string, SyntenyRegionData>([
      ['r1', buildRegionData({ start: 0, end: 100 }, [])],
      ['r2', buildRegionData({ start: 0, end: 100 }, [feat({ start: 10, end: 50 })])],
    ])
    const result = getFirstCoverage(rpcDataMap)
    expect(result).toBeDefined()
    expect(result!.coverageMaxDepth).toBe(1)
  })
})
