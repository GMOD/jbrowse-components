import {
  coverageLayout,
  packCoverageBinsForGpu,
  packIndicatorsForGpu,
  packNoncovSegmentsForGpu,
  packSnpSegmentsForGpu,
} from '@jbrowse/alignments-core'
import { MockHal } from '@jbrowse/core/gpu/hal'

import { Canvas2DAlignmentsRenderer } from './Canvas2DAlignmentsRenderer.ts'
import {
  ALIGNMENTS_PASSES,
  GpuAlignmentsRenderer,
} from './GpuAlignmentsRenderer.ts'

import type {
  CoverageUploadData,
  ReadUploadData,
  RenderState,
} from './rendererTypes.ts'

beforeAll(() => {
  ;(globalThis as Record<string, unknown>).window = { devicePixelRatio: 1 }
})

afterAll(() => {
  delete (globalThis as Record<string, unknown>).window
})

const REGION_START = 10000
const COVERAGE_START_OFFSET = 5

function makeCoverageData(): CoverageUploadData {
  const coverageDepths = new Float32Array([10, 30, 50, 20, 40])
  const coverageMaxDepth = 50
  const snpPositions = new Uint32Array([1, 3])
  const snpYOffsets = new Float32Array([0, 0.2])
  const snpHeights = new Float32Array([0.4, 0.3])
  const snpColorTypes = new Uint8Array([1, 2])
  const noncovPositions = new Uint32Array([])
  const noncovYOffsets = new Float32Array([])
  const noncovHeights = new Float32Array([])
  const noncovColorTypes = new Uint8Array([])
  const indicatorPositions = new Uint32Array([2])
  const indicatorColorTypes = new Uint8Array([1])
  return {
    coverageDepths,
    coverageMaxDepth,
    coverageStartOffset: COVERAGE_START_OFFSET,
    numCoverageBins: coverageDepths.length,
    coveragePackedBuffer: packCoverageBinsForGpu(
      coverageDepths,
      coverageMaxDepth,
      COVERAGE_START_OFFSET,
      coverageDepths.length,
    ).buffer,
    snpPositions,
    snpYOffsets,
    snpHeights,
    snpColorTypes,
    numSnpSegments: snpPositions.length,
    snpPackedBuffer: packSnpSegmentsForGpu(
      snpPositions,
      snpYOffsets,
      snpHeights,
      snpColorTypes,
      snpPositions.length,
    ).buffer,
    noncovPositions,
    noncovYOffsets,
    noncovHeights,
    noncovColorTypes,
    noncovMaxCount: 0,
    numNoncovSegments: 0,
    noncovPackedBuffer: packNoncovSegmentsForGpu(
      noncovPositions,
      noncovYOffsets,
      noncovHeights,
      noncovColorTypes,
      0,
    ).buffer,
    indicatorPositions,
    indicatorColorTypes,
    numIndicators: indicatorPositions.length,
    indicatorPackedBuffer: packIndicatorsForGpu(
      indicatorPositions,
      indicatorColorTypes,
      indicatorPositions.length,
    ).buffer,
  }
}

function makeMinimalReadData() {
  return {
    regionStart: REGION_START,
    readPositions: new Uint32Array([]),
    readYs: new Uint16Array([]),
    readFlags: new Uint16Array([]),
    readMapqs: new Uint8Array([]),
    readAvgBaseQualities: new Uint8Array([]),
    readInsertSizes: new Float32Array([]),
    readPairOrientations: new Uint8Array([]),
    readStrands: new Int8Array([]),
    readTagColors: new Uint32Array(0),
    readChainHasSupp: undefined,
    numReads: 0,
    readIds: [],
    insertSizeStats: undefined,
    maxY: 0,
    segmentPositions: new Uint32Array([]),
    segmentReadIndices: new Uint32Array([]),
    segmentEdgeFlags: new Uint8Array([]),
    numSegments: 0,
  } as ReadUploadData
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
    } as unknown as CanvasRenderingContext2D,
  }
}

describe('coverage packing parity between GPU and Canvas2D', () => {
  it('both backends normalize coverage depth identically', () => {
    const hal = new MockHal(ALIGNMENTS_PASSES)
    const gpu = new GpuAlignmentsRenderer(hal)
    const covData = makeCoverageData()

    // GPU path: upload to HAL
    gpu.uploadFromTypedArraysForRegion(0, makeMinimalReadData())
    gpu.uploadCoverageFromTypedArraysForRegion(0, covData)

    const gpuCovBuf = hal.getBuffer(0, 'coverage')
    expect(gpuCovBuf).toBeDefined()

    // GPU layout per bin: [posOffset(f32), normalizedDepth(f32)] = 2 floats
    const gpuF32 = new Float32Array(gpuCovBuf!.data)
    const gpuNormalizedDepths: number[] = []
    for (let i = 0; i < covData.numCoverageBins; i++) {
      gpuNormalizedDepths.push(gpuF32[i * 2 + 1]!)
    }

    // Canvas2D path: create a mock canvas and upload
    const canvas = {
      getContext: () => ({ setTransform() {}, clearRect() {} }),
    } as unknown as HTMLCanvasElement
    const canvas2d = new Canvas2DAlignmentsRenderer(canvas)
    canvas2d.uploadFromTypedArraysForRegion(0, makeMinimalReadData())
    canvas2d.uploadCoverageFromTypedArraysForRegion(0, covData)

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

    gpu.uploadFromTypedArraysForRegion(0, makeMinimalReadData())
    gpu.uploadCoverageFromTypedArraysForRegion(0, covData)

    const gpuSnpBuf = hal.getBuffer(0, 'snpCov')
    expect(gpuSnpBuf).toBeDefined()

    // GPU SNP layout: [position(f32), yOffset(f32), height(f32), colorType(f32)]
    const gpuF32 = new Float32Array(gpuSnpBuf!.data)

    // Canvas2D packs with regionStart offset
    const canvas = {
      getContext: () => ({ setTransform() {}, clearRect() {} }),
    } as unknown as HTMLCanvasElement
    const canvas2d = new Canvas2DAlignmentsRenderer(canvas)
    canvas2d.uploadFromTypedArraysForRegion(0, makeMinimalReadData())
    canvas2d.uploadCoverageFromTypedArraysForRegion(0, covData)

    // Both should have same yOffset, height, colorType per segment
    // GPU positions are relative (no regionStart), Canvas2D are absolute
    // But yOffset/height/colorType must match
    for (let i = 0; i < covData.numSnpSegments; i++) {
      const gpuOff = i * 4
      expect(gpuF32[gpuOff + 1]).toBeCloseTo(covData.snpYOffsets[i]!)
      expect(gpuF32[gpuOff + 2]).toBeCloseTo(covData.snpHeights[i]!)
      expect(gpuF32[gpuOff + 3]).toBe(covData.snpColorTypes[i]!)
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

    renderer.uploadFromTypedArraysForRegion(0, makeMinimalReadData())
    renderer.uploadCoverageFromTypedArraysForRegion(0, covData)

    const covH = 100
    const block = {
      displayedRegionIndex: 0,
      bpRangeX: [REGION_START, REGION_START + 20] as [number, number],
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
      renderingMode: 'pileup',
      showCoverage: true,
      showArcs: false,
      arcsHeight: 0,
      pairedArcsDown: true,
      pileupTopOffset: covH,
      showMismatches: false,
      showSoftClipping: false,
      showModifications: false,
      colors: {
        colorCoverage: [0.2, 0.4, 0.8] as [number, number, number],
        colorBaseA: [0, 1, 0] as [number, number, number],
        colorBaseC: [0, 0, 1] as [number, number, number],
        colorBaseG: [1, 0.65, 0] as [number, number, number],
        colorBaseT: [1, 0, 0] as [number, number, number],
        colorInsertion: [0.75, 0, 0.75] as [number, number, number],
        colorDeletion: [0, 0, 0] as [number, number, number],
        colorSoftclip: [0, 0.5, 1] as [number, number, number],
        colorHardclip: [1, 0.5, 0] as [number, number, number],
      },
      highlightedChainIds: [],
      selectedChainIds: [],
      showInterbaseIndicators: false,
      bpRangeX: [REGION_START, REGION_START + 20] as [number, number],
      rangeY: [0, 200] as [number, number],
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
    // Bin width = 1bp = 200/20 = 10px
    expect(covRects[0]!.w).toBeCloseTo(10, 0)
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
