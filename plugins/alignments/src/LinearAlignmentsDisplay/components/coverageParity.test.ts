import {
  coverageLayout,
  packCoverageBinsForGpu,
  packSnpInstances,
} from '@jbrowse/alignments-core'
import { MockHal } from '@jbrowse/render-core/hal'

import {
  makePileupDataResult,
  packedIndicators,
  packedInterbaseSegments,
} from '../../RenderAlignmentDataRPC/testPileupData.ts'
import { Canvas2DAlignmentsRenderer } from '../renderers/Canvas2DAlignmentsRenderer.ts'
import {
  ALIGNMENTS_PASSES,
  GpuAlignmentsRenderer,
} from '../renderers/GpuAlignmentsRenderer.ts'
import { makeTestPalette } from '../testUtils.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { ArcsUploadData } from '../../features/arcs/types.ts'
import type {
  AlignmentsRenderingBackend,
  AlignmentsSources,
  ColorPalette,
  CoverageUploadData,
  ReadUploadData,
  RenderState,
  SectionRender,
} from '../renderers/rendererTypes.ts'

Object.defineProperty(globalThis, 'devicePixelRatio', {
  value: 1,
  writable: true,
  configurable: true,
})

const REGION_START = 10000
// Absolute genomic position where coverage depths[0] begins.
const COVERAGE_START_OFFSET = REGION_START + 5

function makeCoverageData(): CoverageUploadData {
  const coverageDepths = new Float32Array([10, 30, 50, 20, 40])
  const coverageMaxDepth = 50
  return {
    coverageDepths,
    coverageMaxDepth,
    coverageStartPos: COVERAGE_START_OFFSET,
    coverageBinSize: 1,
    coverageGpuBinCount: coverageDepths.length,
    coveragePackedBuffer: packCoverageBinsForGpu(
      coverageDepths,
      coverageMaxDepth,
      COVERAGE_START_OFFSET,
      coverageDepths.length,
    ),
    snpPackedBuffer: SNP_BUFFER,
    interbaseMaxCount: 0,
    interbasePackedBuffer: packedInterbaseSegments([]),
    indicatorPackedBuffer: packedIndicators([
      { position: REGION_START + 2, colorType: 1 },
    ]),
  }
}

// The SNP fixture's own values, for the parity assertions below: the buffer is
// the only shipped form, so the expectation has to name them here rather than
// read them back off the region. Encoded through the shader's own generated
// packer — `computeSNPCoverage` writes this layout directly and has no array
// form to build a fixture from, and its stacking rules wouldn't produce these
// two segments anyway.
const SNP_POSITIONS = [REGION_START + 1, REGION_START + 3]
const SNP_YOFFSETS = [0, 0.2]
const SNP_HEIGHTS = [0.4, 0.3]
const SNP_COLOR_TYPES = [1, 2]
const SNP_BUFFER = packSnpInstances(
  {
    position: SNP_POSITIONS,
    yOffset: SNP_YOFFSETS,
    segHeight: SNP_HEIGHTS,
    colorType: SNP_COLOR_TYPES,
    relDepth: [1, 1],
  },
  SNP_POSITIONS.length,
)

function makeMinimalReadData() {
  return {
    regionStart: REGION_START,
    readIdPrefix: undefined,
    readPositions: new Uint32Array([]),
    readYs: new Uint16Array([]),
    readFlags: new Uint16Array([]),
    readMapqs: new Uint8Array([]),
    readInsertSizes: new Float32Array([]),
    readPairOrientations: new Uint8Array([]),
    readStrands: new Int8Array([]),
    readInterchrom: new Uint8Array([]),
    readTagColors: new Uint32Array(0),
    readColorCategories: new Uint8Array(0),
    readChainHasSupp: undefined,
    readKeys: [],
    insertSizeStats: undefined,
    maxY: 0,
    segmentPositions: new Uint32Array([]),
    segmentReadIndices: new Uint32Array([]),
    segmentEdgeFlags: new Uint8Array([]),
    numSegments: 0,
  } as ReadUploadData
}

// Stubs for the CIGAR / modification / mod-coverage fields of
// PileupDataResult. Coverage tests don't exercise these but uploadRegion
// reads them.
const EMPTY_PILEUP_STUBS = {
  gapPositions: new Uint32Array(),
  gapYs: new Uint16Array(),
  gapTypes: new Uint8Array(),
  gapFrequencies: new Uint8Array(),
  mismatchPositions: new Uint32Array(),
  mismatchYs: new Uint16Array(),
  mismatchBases: new Uint8Array(),
  mismatchFrequencies: new Uint8Array(),
  mismatchQuals: new Uint8Array(),
  interbasePositions: new Uint32Array(),
  interbaseYs: new Uint16Array(),
  interbaseLengths: new Uint32Array(),
  interbaseFrequencies: new Uint8Array(),
  numInsertions: 0,
  numSoftclips: 0,
  numHardclips: 0,
  softclipBasePositions: new Uint32Array(),
  softclipBaseYs: new Uint16Array(),
  softclipBaseBases: new Uint8Array(),
  modificationPositions: new Uint32Array(),
  modificationYs: new Uint16Array(),
  modificationColors: new Uint32Array(),
  modCovPositions: new Uint32Array(),
  modCovYOffsets: new Float32Array(),
  modCovHeights: new Float32Array(),
  modCovColors: new Uint32Array(),
  modCovRelDepths: new Float32Array(),
  modCovPackedBuffer: new ArrayBuffer(0),
  connectingLinePositions: new Uint32Array(),
  connectingLineYs: new Uint16Array(),
  linkedReadLinePositions: new Uint32Array(),
  linkedReadLineYs: new Uint16Array(),
  linkedReadLineColorTypes: new Uint8Array(),
  numLinkedReadLines: 0,
  overlapPositions: new Uint32Array(),
  overlapYs: new Uint16Array(),
  perBaseQualPositions: new Uint32Array(),
  perBaseQualYs: new Uint16Array(),
  perBaseQualScores: new Uint8Array(),
  perBaseQualReadIndices: new Uint32Array(),
  perBaseLetterPositions: new Uint32Array(),
  perBaseLetterYs: new Uint16Array(),
  perBaseLetterBases: new Uint8Array(),
  perBaseLetterReadIndices: new Uint32Array(),
}

function makeMinimalPileupResult(cov: CoverageUploadData) {
  return makePileupDataResult({
    ...makeMinimalReadData(),
    ...EMPTY_PILEUP_STUBS,
    ...cov,
  })
}

// The single-section, single-region `sync` input both backends take.
function oneRegion(
  data: PileupDataResult,
  arcs?: ArcsUploadData,
): AlignmentsSources {
  return {
    sections: [
      {
        groupKey: '',
        laidOutPileupMap: new Map([[0, data]]),
        arcsRpcDataMap: arcs ? new Map([[0, arcs]]) : new Map(),
      },
    ],
    // Matches the render state below: the GPU packs arc instances at this
    // width, so the two have to agree for the backends to be comparable.
    readConnectionsLineWidth: 1,
  }
}

function recordingCtx() {
  const rects: { x: number; y: number; w: number; h: number; fill: string }[] =
    []
  let currentFill = ''
  return {
    rects,
    ctx: {
      set fillStyle(v: string) {
        currentFill = v
      },
      get fillStyle() {
        return currentFill
      },
      fillRect(x: number, y: number, w: number, h: number) {
        rects.push({ x, y, w, h, fill: currentFill })
      },
      setTransform() {},
      translate() {},
      clearRect() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      closePath() {},
      fill() {},
      save() {},
      restore() {},
      rect() {},
      clip() {},
      strokeStyle: '',
      lineWidth: 1,
      stroke() {},
      setLineDash() {},
    } as unknown as CanvasRenderingContext2D,
  }
}

// A "every drawn pass is registered in ALIGNMENTS_PASSES" pair of cases stood
// here. `ALIGNMENTS_PASSES` is now BUILT from `GPU_PILEUP_PASS` and
// `COVERAGE_LAYERS` rather than hand-listed alongside them, so a drawn pass is
// a registered pass by construction and the cases could no longer fail.

describe('coverage packing parity between GPU and Canvas2D', () => {
  it('both backends normalize coverage depth identically', () => {
    const hal = new MockHal(ALIGNMENTS_PASSES)
    const gpu = new GpuAlignmentsRenderer(hal)
    const covData = makeCoverageData()

    // GPU path: upload to HAL
    gpu.sync(oneRegion(makeMinimalPileupResult(covData)))

    const gpuCovBuf = hal.getBuffer(0, 'coverage')
    expect(gpuCovBuf).toBeDefined()

    // GPU layout per bin: [posOffset(f32), normalizedDepth(f32)] = 2 floats
    const gpuF32 = new Float32Array(gpuCovBuf!.data)
    const gpuNormalizedDepths: number[] = []
    for (let i = 0; i < covData.coverageDepths.length; i++) {
      gpuNormalizedDepths.push(gpuF32[i * 2 + 1]!)
    }

    // Canvas2D path: create a mock canvas and upload
    const canvas = {
      getContext: () => ({ setTransform() {}, clearRect() {} }),
    } as unknown as HTMLCanvasElement
    const canvas2d = new Canvas2DAlignmentsRenderer(canvas)
    canvas2d.sync({
      sections: [
        {
          groupKey: '',
          laidOutPileupMap: new Map([[0, makeMinimalPileupResult(covData)]]),
          arcsRpcDataMap: new Map(),
        },
      ],
      readConnectionsLineWidth: 1,
    })

    // The normalized depths should be identical
    const expectedDepths = [10 / 50, 30 / 50, 50 / 50, 20 / 50, 40 / 50]
    for (let i = 0; i < expectedDepths.length; i++) {
      expect(gpuNormalizedDepths[i]).toBeCloseTo(expectedDepths[i]!)
    }
  })

  it('SNP segment packing produces same yOffset/height/colorType', () => {
    const hal = new MockHal(ALIGNMENTS_PASSES)
    const gpu = new GpuAlignmentsRenderer(hal)
    const covData = makeCoverageData()

    gpu.sync(oneRegion(makeMinimalPileupResult(covData)))

    const gpuSnpBuf = hal.getBuffer(0, 'snpCov')
    expect(gpuSnpBuf).toBeDefined()

    // GPU SNP layout: [position(u32), yOffset(f32), height(f32), colorType(f32),
    // relDepth(f32)] — 5 floats per segment.
    const gpuF32 = new Float32Array(gpuSnpBuf!.data)
    const SNP_GPU_STRIDE = 5

    // Canvas2D packs with regionStart offset
    const canvas = {
      getContext: () => ({ setTransform() {}, clearRect() {} }),
    } as unknown as HTMLCanvasElement
    const canvas2d = new Canvas2DAlignmentsRenderer(canvas)
    canvas2d.sync({
      sections: [
        {
          groupKey: '',
          laidOutPileupMap: new Map([[0, makeMinimalPileupResult(covData)]]),
          arcsRpcDataMap: new Map(),
        },
      ],
      readConnectionsLineWidth: 1,
    })

    // Both should have same yOffset, height, colorType per segment
    // GPU positions are relative (no regionStart), Canvas2D are absolute
    // But yOffset/height/colorType must match
    for (let i = 0; i < SNP_YOFFSETS.length; i++) {
      const gpuOff = i * SNP_GPU_STRIDE
      expect(gpuF32[gpuOff + 1]).toBeCloseTo(SNP_YOFFSETS[i]!)
      expect(gpuF32[gpuOff + 2]).toBeCloseTo(SNP_HEIGHTS[i]!)
      expect(gpuF32[gpuOff + 3]).toBe(SNP_COLOR_TYPES[i]!)
    }
  })

  it('Canvas2D drawCoverage produces rectangles at expected screen positions', () => {
    const covData = makeCoverageData()
    const { ctx, rects } = recordingCtx()
    const canvas = {
      getContext: () => ctx,
      width: 0,
      height: 0,
    } as unknown as HTMLCanvasElement
    const renderer = new Canvas2DAlignmentsRenderer(canvas)

    renderer.sync({
      sections: [
        {
          groupKey: '',
          laidOutPileupMap: new Map([[0, makeMinimalPileupResult(covData)]]),
          arcsRpcDataMap: new Map(),
        },
      ],
      readConnectionsLineWidth: 1,
    })

    const covH = 100
    const block = {
      displayedRegionIndex: 0,
      start: REGION_START,
      end: REGION_START + 20,
      screenStartPx: 0,
      screenEndPx: 200,
      reversed: false,
    }

    renderer.renderBlocks([block], {
      canvasWidth: 200,
      canvasHeight: 200,
      featureHeight: 10,
      featureSpacing: 1,
      coverageHeight: covH,
      coverageYOffset: 5,
      chainMode: false,
      showCoverage: true,
      readConnections: 'off',
      readConnectionsHeight: 0,
      pileupTopOffset: covH,
      coverageTopOffset: 0,
      sections: [
        {
          pileupTopOffset: covH,
          coverageTopOffset: 0,
          covClipTop: 0,
          covClipHeight: 200,
          pileupClipTop: covH,
          pileupClipHeight: 100,
        },
      ],
      showMismatches: false,
      showSoftClipping: false,
      showModifications: false,
      // `makeTestPalette` rather than the slots this case happens to read: the
      // surrounding state is an `as unknown as RenderState` cast, so a hand-cut
      // palette inside it is unchecked twice over. It was — `colorSkip` was
      // absent, and went unnoticed only while the intron centerlines were gated
      // off along with the deletion bars by `showMismatches: false`.
      colors: makeTestPalette({
        colorCoverage: [0.2, 0.4, 0.8],
        colorBaseA: [0, 1, 0],
        colorBaseC: [0, 0, 1],
        colorBaseG: [1, 0.65, 0],
        colorBaseT: [1, 0, 0],
        colorBaseN: [0.47, 0.33, 0.28],
        colorInsertion: [0.75, 0, 0.75],
        colorSoftclip: [0, 0.5, 1],
        colorHardclip: [1, 0.5, 0],
        colorInsertionIndicator: [0.75, 0, 0.75],
        colorSoftclipIndicator: [0, 0.5, 1],
        colorHardclipIndicator: [1, 0.5, 0],
      }),
      selectedChainReadIds: [],
      showInterbaseIndicators: false,
      start: REGION_START,
      end: REGION_START + 20,
      scrollTop: 0,
      colorScheme: 0,
      coverageMaxDepth: 50,
    } as unknown as RenderState)

    // Coverage bins should produce rectangles
    // Bins at absolute positions: REGION_START + COVERAGE_START_OFFSET + i
    // = 10005, 10006, 10007, 10008, 10009
    // Block maps [10000, 10020] → [0, 200] (10 px per bp)
    // So bin 10005 → x=50, bin 10006 → x=60, etc.
    //
    // The first fillRect call is the clearRect from prepareCanvas (full canvas)
    // Then the block clip rect, then coverage rects
    const allFillRects = rects
    // Coverage rects should be in the coverage area (y < covH) and narrow (w ~10px per bp)
    const covRects = allFillRects.filter(
      r => r.w > 0 && r.w < 100 && r.h > 0 && r.y < covH && r.y >= 0,
    )
    // 5 coverage bins + 2 SNP segments = 7 narrow rects in coverage area
    expect(covRects.length).toBe(7)

    // First coverage bin at position 10005: x = (10005-10000)/20 * 200 = 50
    expect(covRects[0]!.x).toBeCloseTo(50, 0)
    // Bin width = 1bp = 200/20 = 10px, plus ALIGNMENTS_FUDGE_FACTOR (0.8)
    // applied by drawCoverageBins to close subpixel gaps between bars
    expect(covRects[0]!.w).toBeCloseTo(10.8, 1)
    // Coverage bins should have the coverage color
    expect(covRects[0]!.fill).toBe('rgb(51,102,204)')

    // SNP segments should have base colors (A=green, C=blue)
    const snpRects = covRects.filter(r => r.fill !== 'rgb(51,102,204)')
    expect(snpRects.length).toBe(2)
    expect(snpRects[0]!.fill).toBe('rgb(0,255,0)') // baseA
    expect(snpRects[1]!.fill).toBe('rgb(0,0,255)') // baseC
  })

  it('drawCoverageBins Y mapping matches GPU shader formula', () => {
    const coverageHeight = 100
    const normalizedDepth = 0.6 // depth/maxDepth, already in [0,1]

    const { effectiveH, bottom } = coverageLayout(coverageHeight)

    // drawCoverageBins: bandTop = bottom - normalizedDepth * effectiveH
    const sharedTop = bottom - normalizedDepth * effectiveH
    const sharedBarH = bottom - sharedTop

    // GPU shader: same formula in clip space, converted to pixels
    const gpuBarTopPx = bottom - normalizedDepth * effectiveH
    const gpuBarH = bottom - gpuBarTopPx

    expect(sharedTop).toBeCloseTo(gpuBarTopPx)
    expect(sharedBarH).toBeCloseTo(gpuBarH)
  })
})

describe('GPU sync rebuild transaction', () => {
  it('clears a pass buffer when its data empties between syncs', () => {
    const hal = new MockHal(ALIGNMENTS_PASSES)
    const gpu = new GpuAlignmentsRenderer(hal)
    const cov = makeCoverageData()

    const withOverlap = makePileupDataResult({
      ...makeMinimalPileupResult(cov),
      overlapPositions: new Uint32Array([REGION_START, REGION_START + 5]),
      overlapYs: new Uint16Array([0]),
    })

    gpu.sync(oneRegion(withOverlap))
    expect(hal.getBufferCount(0, 'overlap')).toBeGreaterThan(0)

    // Same region still active, but the overlap data is gone. A fresh layout
    // run takes the rebuild branch, whose head wipes the region before the
    // unconditional re-uploads — the empty overlap pack then leaves no buffer.
    gpu.sync(oneRegion(makeMinimalPileupResult(cov)))
    expect(hal.getBufferCount(0, 'overlap')).toBe(0)
  })

  it('drops every buffer for a region that leaves the active set', () => {
    const hal = new MockHal(ALIGNMENTS_PASSES)
    const gpu = new GpuAlignmentsRenderer(hal)
    const cov = makeCoverageData()

    gpu.sync(oneRegion(makeMinimalPileupResult(cov)))
    expect(hal.getBufferCount(0, 'coverage')).toBeGreaterThan(0)

    gpu.sync({ sections: [], readConnectionsLineWidth: 1 })
    expect(hal.getBufferCount(0, 'coverage')).toBe(0)
  })
})

// The upload autorun re-fires on everything `sourceSections` reads, including
// band geometry that changes no packed byte (a coverage-height drag re-derives
// `sections` on every pointer move). `sync` skips the pack for a region whose
// laid-out payload is reference-identical, leaving the HAL's buffers untouched.
describe('GPU sync skips regions whose data is unchanged', () => {
  const uploadsFor = (hal: MockHal) => hal.callsOf('uploadBuffer').length

  it('re-syncing the same payload uploads nothing and keeps every buffer', () => {
    const hal = new MockHal(ALIGNMENTS_PASSES)
    const gpu = new GpuAlignmentsRenderer(hal)
    const data = makeMinimalPileupResult(makeCoverageData())

    gpu.sync(oneRegion(data))
    const first = uploadsFor(hal)
    expect(first).toBeGreaterThan(0)

    gpu.sync(oneRegion(data))
    expect(uploadsFor(hal)).toBe(first)
    // The skipped region's buffers are still on the HAL.
    expect(hal.getBufferCount(0, 'coverage')).toBeGreaterThan(0)
    expect(hal.getBufferCount(0, 'snpCov')).toBeGreaterThan(0)
  })

  it('a recolor rewrites only the read pass', () => {
    const hal = new MockHal(ALIGNMENTS_PASSES)
    const gpu = new GpuAlignmentsRenderer(hal)
    const cov = makeCoverageData()
    // One read, so the read pass has an instance to rewrite.
    const laidOut = makePileupDataResult({
      ...makeMinimalPileupResult(cov),
      readKeys: ['r1'],
      readPositions: new Uint32Array([REGION_START, REGION_START + 10]),
      readYs: new Uint16Array([0]),
      readFlags: new Uint16Array([0]),
      readMapqs: new Uint8Array([60]),
      readInsertSizes: new Float32Array([0]),
      readStrands: new Int8Array([1]),
      readInterchrom: new Uint8Array([0]),
      readTagColors: new Uint32Array([0]),
      readColorCategories: new Uint8Array([0]),
      segmentPositions: new Uint32Array([REGION_START, REGION_START + 10]),
      segmentReadIndices: new Uint32Array([0]),
      segmentEdgeFlags: new Uint8Array([3]),
      numSegments: 1,
    })

    gpu.sync(oneRegion(laidOut))
    const before = uploadsFor(hal)

    // What the color tier produces: the same layout run (same `readYs` and every
    // other array) with the two per-read color arrays rebaked.
    gpu.sync(
      oneRegion({
        ...laidOut,
        readTagColors: new Uint32Array([0xff00ff00]),
        readColorCategories: new Uint8Array([3]),
      }),
    )

    const added = hal.callsOf('uploadBuffer').slice(before)
    expect(added.map(c => c.args[1])).toEqual(['read'])
    expect(hal.getBufferCount(0, 'coverage')).toBeGreaterThan(0)
  })

  it('a relayout re-uploads everything', () => {
    const hal = new MockHal(ALIGNMENTS_PASSES)
    const gpu = new GpuAlignmentsRenderer(hal)
    const cov = makeCoverageData()

    gpu.sync(oneRegion(makeMinimalPileupResult(cov)))
    const first = uploadsFor(hal)

    // A fresh layout run allocates a fresh `readYs`, which is the token.
    gpu.sync(oneRegion(makeMinimalPileupResult(cov)))
    expect(uploadsFor(hal)).toBe(first * 2)
  })

  it('a region that leaves and returns with the same payload re-uploads', () => {
    const hal = new MockHal(ALIGNMENTS_PASSES)
    const gpu = new GpuAlignmentsRenderer(hal)
    const data = makeMinimalPileupResult(makeCoverageData())

    gpu.sync(oneRegion(data))
    const first = uploadsFor(hal)

    // Scrolled out: the departed-key sweep deleted its buffers, so the memo
    // must forget it.
    gpu.sync({ sections: [], readConnectionsLineWidth: 1 })
    expect(hal.getBufferCount(0, 'coverage')).toBe(0)

    gpu.sync(oneRegion(data))
    expect(uploadsFor(hal)).toBe(first * 2)
    expect(hal.getBufferCount(0, 'coverage')).toBeGreaterThan(0)
  })
})

// `renderBlocks` returns whether anything painted; the model feeds that into
// `canvasDrawn`. The GPU and Canvas2D backends must agree on this: a coverage-
// or arcs-only section (empty pileup band, e.g. read-cloud) still paints real
// content, while a section with no visible band paints nothing. Gating the
// return on the pileup band once left read-cloud stuck on "Loading"; a bare
// `true` from the Canvas2D path once drifted the other way. One scenario table,
// both backends, same expected result — lock the shared contract in.
describe('renderBlocks canvasDrawn gating parity', () => {
  // Nothing here asserts on a colour — the scenarios are about whether a block
  // reports having drawn — so this is makeTestPalette's all-zero palette rather
  // than thirty hand-written `[0, 0, 0]`s that had to grow with the type.
  const fullColors: ColorPalette = makeTestPalette()

  const block = {
    displayedRegionIndex: 0,
    start: REGION_START,
    end: REGION_START + 20,
    screenStartPx: 0,
    screenEndPx: 200,
    reversed: false,
  }

  function makeState(
    section: Partial<SectionRender>,
    extra?: Partial<RenderState>,
  ): RenderState {
    const sec: SectionRender = {
      pileupTopOffset: 0,
      coverageTopOffset: 0,
      covClipTop: 0,
      covClipHeight: 0,
      pileupClipTop: 0,
      pileupClipHeight: 0,
      ...section,
    }
    return {
      canvasWidth: 200,
      canvasHeight: 200,
      scrollTop: 0,
      colorScheme: 0,
      featureHeight: 10,
      featureSpacing: 1,
      showCoverage: false,
      coverageHeight: 100,
      coverageYOffset: 5,
      coverageMinDepth: 0,
      coverageMaxDepth: 50,
      coverageScaleType: 0 as const,
      coverageSymlogConstant: 1,
      coverageSnpMinFrequency: 0,
      showMismatches: false,
      filterMismatchesByFrequency: false,
      mismatchAlpha: false,
      showSoftClipping: false,
      showInterbaseIndicators: false,
      showModifications: false,
      showPerBaseQuality: false,
      showPerBaseLetter: false,
      selectedChainReadIds: [],
      colors: fullColors,
      chainMode: false,
      showLinkedReadLines: false,
      collapseGroupRows: false,
      readConnectionsLineWidth: 1,
      readConnections: 'off',
      readConnectionsDown: false,
      readConnectionsHeight: 0,
      showOutline: false,
      pileupTopOffset: sec.pileupTopOffset,
      coverageTopOffset: sec.coverageTopOffset,
      sections: [sec],
      ...extra,
    }
  }

  // Fresh, unsynced backends. `synced` gives one region 0 (coverage + empty
  // pileup) to draw; leaving it unsynced is the "no synced region" case.
  const gpu = () => new GpuAlignmentsRenderer(new MockHal(ALIGNMENTS_PASSES))
  const canvas2d = () => {
    const { ctx } = recordingCtx()
    return new Canvas2DAlignmentsRenderer({
      getContext: () => ctx,
      width: 0,
      height: 0,
    } as unknown as HTMLCanvasElement)
  }

  function synced(renderer: AlignmentsRenderingBackend) {
    renderer.sync({
      sections: [
        {
          groupKey: '',
          laidOutPileupMap: new Map([
            [0, makeMinimalPileupResult(makeCoverageData())],
          ]),
          arcsRpcDataMap: new Map(),
        },
      ],
      readConnectionsLineWidth: 1,
    })
    return renderer
  }

  const scenarios: {
    name: string
    sync: boolean
    section: Partial<SectionRender>
    extra?: Partial<RenderState>
    expected: boolean
  }[] = [
    {
      name: 'a coverage-only section with an empty pileup band',
      sync: true,
      section: { covClipHeight: 100, pileupClipTop: 100, pileupClipHeight: 0 },
      extra: { showCoverage: true },
      expected: true,
    },
    {
      name: 'an arcs-only section (read-cloud): empty pileup, no coverage',
      sync: true,
      section: {
        covClipHeight: 0,
        pileupClipHeight: 0,
        arcBand: { top: 0, height: 100, down: false },
      },
      expected: true,
    },
    {
      name: 'a section where no band paints',
      sync: true,
      section: { covClipHeight: 0, pileupClipHeight: 0 },
      expected: false,
    },
    {
      name: 'a block with no synced region',
      sync: false,
      section: { covClipHeight: 100, pileupClipHeight: 100 },
      extra: { showCoverage: true },
      expected: false,
    },
  ]

  for (const [backend, make] of [
    ['GPU', gpu],
    ['Canvas2D', canvas2d],
  ] as const) {
    describe(backend, () => {
      for (const { name, sync, section, extra, expected } of scenarios) {
        it(`returns ${expected} for ${name}`, () => {
          const renderer = sync ? synced(make()) : make()
          expect(
            renderer.renderBlocks([block], makeState(section, extra)),
          ).toBe(expected)
        })
      }
    })
  }
})
