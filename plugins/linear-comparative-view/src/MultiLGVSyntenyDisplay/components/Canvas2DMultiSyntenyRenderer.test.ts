import {
  DEFAULT_CIGAR_OP_DRAW_COLORS,
  computeInsertionIndicators,
  computeSNPCoverage,
  extractIndelsFromCs,
  extractMismatchesFromCs,
} from '@jbrowse/alignments-core'
import { SvgCanvas } from '@jbrowse/core/util/offscreenCanvasUtils'
import { computeCoverage } from '@jbrowse/plugin-alignments'

import { renderMultiSyntenyToCtx } from './Canvas2DMultiSyntenyRenderer.ts'

import type { SyntenyRegionData } from '../../LinearSyntenyRPC/syntenyRegionTypes.ts'
import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'

function feat(overrides: Partial<MultiPairFeature> = {}): MultiPairFeature {
  return {
    queryGenome: 'genomeA',
    origRefName: 'chr1',
    start: 100,
    end: 200,
    mateStart: 0,
    mateEnd: 100,
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

function buildRegion(
  refName: string,
  start: number,
  end: number,
  features: MultiPairFeature[],
): SyntenyRegionData {
  const regionStart = Math.floor(start)
  const regionEnd = Math.ceil(end)
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
    refName,
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

function simpleBpToPx(refName: string, coord: number) {
  if (refName === 'chr1') {
    return coord * 0.01
  }
  if (refName === 'chr2') {
    return 500 + coord * 0.01
  }
  return undefined
}

const baseOpts = {
  width: 1000,
  height: 200,
  rowHeight: 20,
  rowSpacing: false,
  bpToPx: simpleBpToPx,
  colorBy: 'strand',
  labelW: 0,
  showSnps: false,
  colors: DEFAULT_CIGAR_OP_DRAW_COLORS,
  coverageColor: '#999999',
}

describe('renderMultiSyntenyToCtx multi-region coverage', () => {
  test('renders coverage for multiple regions', () => {
    const region1 = buildRegion('chr1', 0, 1000, [
      feat({ origRefName: 'chr1', start: 100, end: 500 }),
    ])
    const region2 = buildRegion('chr2', 0, 1000, [
      feat({ origRefName: 'chr2', start: 200, end: 600 }),
    ])

    const ctx = new SvgCanvas()
    renderMultiSyntenyToCtx(ctx, new Map(), [], {
      ...baseOpts,
      coverageHeight: 50,
      coverageRegions: [region1, region2],
    })

    const svg = ctx.getSerializedSvg()
    const rectCount = (svg.match(/<rect /g) ?? []).length
    expect(rectCount).toBeGreaterThan(1)
  })

  test('renders no coverage when coverageRegions is empty', () => {
    const ctx = new SvgCanvas()
    renderMultiSyntenyToCtx(ctx, new Map(), [], {
      ...baseOpts,
      coverageHeight: 50,
      coverageRegions: [],
    })

    const svg = ctx.getSerializedSvg()
    const rectCount = (svg.match(/<rect /g) ?? []).length
    expect(rectCount).toBe(1)
  })

  test('renders SNP colored segments on coverage', () => {
    const region = buildRegion('chr1', 0, 200, [
      feat({ origRefName: 'chr1', start: 50, end: 150, cs: ':30*ag:20*ct:49' }),
    ])
    expect(region.snpCount).toBeGreaterThan(0)

    const ctx = new SvgCanvas()
    renderMultiSyntenyToCtx(ctx, new Map(), [], {
      ...baseOpts,
      coverageHeight: 50,
      coverageRegions: [region],
    })

    const svg = ctx.getSerializedSvg()
    expect(svg).toContain(DEFAULT_CIGAR_OP_DRAW_COLORS.baseG)
    expect(svg).toContain(DEFAULT_CIGAR_OP_DRAW_COLORS.baseT)
  })

  test('renders insertion indicator triangles from CS tag insertions', () => {
    // Multiple features with insertions at the same position trigger an indicator
    const features = Array.from({ length: 5 }, () =>
      feat({ origRefName: 'chr1', start: 50, end: 150, cs: ':30+acgt:69' }),
    )
    const region = buildRegion('chr1', 0, 200, features)
    expect(region.numIndicators).toBeGreaterThan(0)

    const ctx = new SvgCanvas()
    renderMultiSyntenyToCtx(ctx, new Map(), [], {
      ...baseOpts,
      coverageHeight: 50,
      coverageRegions: [region],
    })

    const svg = ctx.getSerializedSvg()
    // The insertion color from the default palette should appear in triangle paths
    expect(svg).toContain(DEFAULT_CIGAR_OP_DRAW_COLORS.insertion)
  })

  test('coverage uses provided color, not hardcoded', () => {
    const region = buildRegion('chr1', 0, 200, [
      feat({ origRefName: 'chr1', start: 50, end: 150 }),
    ])

    const ctx = new SvgCanvas()
    renderMultiSyntenyToCtx(ctx, new Map(), [], {
      ...baseOpts,
      coverageHeight: 50,
      coverageRegions: [region],
      coverageColor: '#abcdef',
    })

    const svg = ctx.getSerializedSvg()
    expect(svg).toContain('#abcdef')
  })

  test('skips SNP segments when snpCount exceeds canvas width threshold', () => {
    const region = buildRegion('chr1', 0, 200, [
      feat({ origRefName: 'chr1', start: 50, end: 150, cs: ':30*ag:20*ct:49' }),
    ])
    expect(region.snpCount).toBeGreaterThan(0)

    // Artificially inflate snpCount beyond 4x the narrow width to trigger skip
    const narrowWidth = 2
    const inflatedRegion = {
      ...region,
      snpCount: narrowWidth * 4 + 1,
    }

    const ctx = new SvgCanvas()
    renderMultiSyntenyToCtx(ctx, new Map(), [], {
      ...baseOpts,
      width: narrowWidth,
      coverageHeight: 50,
      coverageRegions: [inflatedRegion],
    })

    const svg = ctx.getSerializedSvg()
    expect(svg).not.toContain(DEFAULT_CIGAR_OP_DRAW_COLORS.baseG)
    expect(svg).not.toContain(DEFAULT_CIGAR_OP_DRAW_COLORS.baseT)
  })
})

describe('renderMultiSyntenyToCtx feature rendering', () => {
  test('renders synteny features', () => {
    const features = [feat({ origRefName: 'chr1', start: 100, end: 200 })]
    const genomeRows = new Map([['genomeA', features]])

    const ctx = new SvgCanvas()
    renderMultiSyntenyToCtx(ctx, genomeRows, ['genomeA'], {
      ...baseOpts,
      coverageHeight: 0,
      coverageRegions: [],
    })

    const svg = ctx.getSerializedSvg()
    const rectCount = (svg.match(/<rect /g) ?? []).length
    expect(rectCount).toBeGreaterThan(1)
  })
})
