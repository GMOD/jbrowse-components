import {
  DEFAULT_CIGAR_OP_DRAW_COLORS,
  computeInsertionIndicators,
  computeSNPCoverage,
  extractIndelsFromCs,
  extractMismatchesFromCs,
} from '@jbrowse/alignments-core'
import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'
import { computeCoverage } from '@jbrowse/plugin-alignments'

import { drawSyntenyToCtx } from './Canvas2DMultiSyntenyRenderer.ts'

import type {
  MultiSyntenyGpuProps,
  MultiSyntenyRenderState,
} from './rendererTypes.ts'
import type { SyntenyRegionData } from '../../LinearSyntenyRPC/syntenyRegionTypes.ts'
import type { SyntenyColorPalette } from '../shared/types.ts'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'
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
  const snp = computeSNPCoverage(mismatches, regionStart, coverage)
  const indicators = computeInsertionIndicators(
    indels,
    coverage.depths,
    coverage.startPos,
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
    coverageStartPos: coverage.startPos,
    snpPositions: snp.positions,
    snpYOffsets: snp.yOffsets,
    snpHeights: snp.heights,
    snpColorTypes: snp.colorTypes,
    snpRelDepths: snp.relDepths,
    snpCount: snp.count,
    mismatchPositions,
    mismatchBases,
    numMismatches: mismatches.length,
    indicatorPositions: indicators.positions,
    numIndicators: indicators.count,
  }
}

const palette: SyntenyColorPalette = {
  coverageColorRgb: [0.6, 0.6, 0.6],
  coverageColorHex: '#999999',
  baseColorGl: {
    A: [0, 1, 0],
    C: [0, 0, 1],
    G: [1, 0.5, 0],
    T: [1, 0, 0],
  },
  syntenyColors: DEFAULT_CIGAR_OP_DRAW_COLORS,
}

function block(
  displayedRegionIndex: number,
  bpStart: number,
  bpEnd: number,
  screenStartPx: number,
  screenEndPx: number,
): RenderBlock {
  return {
    displayedRegionIndex,
    bpRangeX: [bpStart, bpEnd],
    screenStartPx,
    screenEndPx,
    reversed: false,
  }
}

function makeState(
  overrides: Partial<MultiSyntenyRenderState> = {},
): MultiSyntenyRenderState {
  return {
    canvasWidth: 1000,
    canvasHeight: 200,
    rowHeight: 20,
    rowSpacing: false,
    coverageHeight: 0,
    palette,
    displayedGenomes: ['genomeA'],
    labelW: 0,
    ...overrides,
  }
}

function makeGpuProps(
  overrides: Partial<MultiSyntenyGpuProps> = {},
): MultiSyntenyGpuProps {
  return {
    displayedGenomes: ['genomeA'],
    colorBy: 'strand',
    showSnps: false,
    showCoverage: false,
    coverageGlobalMax: 1,
    viewWidth: 1000,
    ...overrides,
  }
}

function draw(
  ctx: SvgCanvas,
  rpcDataMap: Map<number, SyntenyRegionData>,
  blocks: RenderBlock[],
  stateOverrides: Partial<MultiSyntenyRenderState> = {},
  gpuPropsOverrides: Partial<MultiSyntenyGpuProps> = {},
  paletteOverride: SyntenyColorPalette = palette,
) {
  drawSyntenyToCtx(
    ctx,
    {
      rpcDataMap,
      gpuProps: makeGpuProps(gpuPropsOverrides),
      palette: paletteOverride,
    },
    blocks,
    makeState({ palette: paletteOverride, ...stateOverrides }),
  )
}

describe('drawSyntenyToCtx multi-region coverage', () => {
  test('renders coverage for multiple regions', () => {
    const region1 = buildRegion('chr1', 0, 1000, [
      feat({ origRefName: 'chr1', start: 100, end: 500 }),
    ])
    const region2 = buildRegion('chr2', 0, 1000, [
      feat({ origRefName: 'chr2', start: 200, end: 600 }),
    ])

    const ctx = new SvgCanvas()
    draw(
      ctx,
      new Map([
        [0, region1],
        [1, region2],
      ]),
      [block(0, 0, 1000, 0, 500), block(1, 0, 1000, 500, 1000)],
      { coverageHeight: 50 },
      { showCoverage: true },
    )

    const svg = ctx.getSerializedSvg()
    const rectCount = (svg.match(/<rect /g) ?? []).length
    expect(rectCount).toBeGreaterThan(1)
  })

  test('renders no coverage when rpcDataMap is empty', () => {
    const ctx = new SvgCanvas()
    draw(
      ctx,
      new Map(),
      [],
      { coverageHeight: 50, displayedGenomes: [] },
      { showCoverage: true, displayedGenomes: [] },
    )

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
    draw(
      ctx,
      new Map([[0, region]]),
      [block(0, 0, 200, 0, 1000)],
      { coverageHeight: 50 },
      { showCoverage: true },
    )

    const svg = ctx.getSerializedSvg()
    expect(svg).toContain(DEFAULT_CIGAR_OP_DRAW_COLORS.baseG)
    expect(svg).toContain(DEFAULT_CIGAR_OP_DRAW_COLORS.baseT)
  })

  test('renders insertion indicator triangles from CS tag insertions', () => {
    const features = Array.from({ length: 5 }, () =>
      feat({ origRefName: 'chr1', start: 50, end: 150, cs: ':30+acgt:69' }),
    )
    const region = buildRegion('chr1', 0, 200, features)
    expect(region.numIndicators).toBeGreaterThan(0)

    const ctx = new SvgCanvas()
    draw(
      ctx,
      new Map([[0, region]]),
      [block(0, 0, 200, 0, 1000)],
      { coverageHeight: 50 },
      { showCoverage: true },
    )

    const svg = ctx.getSerializedSvg()
    expect(svg).toContain(DEFAULT_CIGAR_OP_DRAW_COLORS.insertion)
  })

  test('coverage uses palette color', () => {
    const region = buildRegion('chr1', 0, 200, [
      feat({ origRefName: 'chr1', start: 50, end: 150 }),
    ])

    const customPalette: SyntenyColorPalette = {
      ...palette,
      coverageColorHex: '#abcdef',
    }

    const ctx = new SvgCanvas()
    draw(
      ctx,
      new Map([[0, region]]),
      [block(0, 0, 200, 0, 1000)],
      { coverageHeight: 50 },
      { showCoverage: true },
      customPalette,
    )

    const svg = ctx.getSerializedSvg()
    expect(svg).toContain('#abcdef')
  })
})

describe('drawSyntenyToCtx feature rendering', () => {
  test('renders synteny features', () => {
    const region = buildRegion('chr1', 0, 200, [
      feat({ origRefName: 'chr1', start: 100, end: 200 }),
    ])

    const ctx = new SvgCanvas()
    draw(ctx, new Map([[0, region]]), [block(0, 0, 200, 0, 1000)])

    const svg = ctx.getSerializedSvg()
    const rectCount = (svg.match(/<rect /g) ?? []).length
    expect(rectCount).toBeGreaterThan(1)
  })

  test('uint32 positions exact at 3 Gbp', () => {
    // Place feature past the float32 precision floor (2^24 ≈ 16.7 Mbp).
    const startBp = 3_000_000_000
    const region = buildRegion('chr1', startBp, startBp + 200, [
      feat({
        origRefName: 'chr1',
        start: startBp + 100,
        end: startBp + 150,
        cs: ':30*ag:20',
      }),
    ])

    const ctx = new SvgCanvas()
    draw(
      ctx,
      new Map([[0, region]]),
      [block(0, startBp, startBp + 200, 0, 1000)],
      { coverageHeight: 50 },
      { showCoverage: true },
    )

    const svg = ctx.getSerializedSvg()
    expect(svg).toContain(DEFAULT_CIGAR_OP_DRAW_COLORS.baseG)
  })
})
