import {
  CANVAS2D_COVERAGE,
  drawCoverageBins,
  drawIndicators,
  drawModCovSegments,
  drawNoncovSegments,
  drawSnpSegments,
  packIndicatorsForCanvas2D,
  packModCovSegmentsForCanvas2D,
  packNoncovSegmentsForCanvas2D,
  packSnpSegmentsForCanvas2D,
} from '@jbrowse/alignments-core'
import {
  clipBlockForCanvas,
  prepareCanvas,
} from '@jbrowse/core/gpu/canvas2dUtils'
import { makeScoreNormalizer } from '@jbrowse/wiggle-core'

import {
  buildModificationFields,
  emptyModificationFields,
} from '../../features/modification/buildRegion.ts'
import { getReadColor, rgb255 } from '../colorUtils.ts'
import { getChainBounds } from './chainOverlayUtils.ts'
import { drawArcsToCtx } from './drawArcs.ts'
import {
  bpToScreenX,
  buildReadIdToIndex,
  computeBlockHeights,
  interbaseRangeEnds,
  pileupRowY,
} from './rendererTypes.ts'
import { drawModifications } from '../../features/modification/drawCanvas.ts'
import {
  arcLineColorPalette,
  getArcPalette,
  linkedReadColorPalette,
} from '../../shaders/palettes.ts'

import type {
  AlignmentsBackend,
  AlignmentsSources,
  ArcsUploadData,
  BaseRegionData,
  CigarUploadData,
  CoverageUploadData,
  ModCoverageUploadData,
  RenderBlock,
  RenderState,
} from './rendererTypes.ts'
import type { PileupDataResult } from '../../RenderPileupDataRPC/types.ts'
import type { ModificationRegionFields } from '../../features/modification/buildRegion.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export interface Canvas2DRegionData
  extends BaseRegionData,
    ModificationRegionFields {
  readFlags: Uint16Array
  readMapqs: Uint8Array
  readAvgBaseQualities: Uint8Array
  readInsertSizes: Float32Array
  readPairOrientations: Uint8Array
  readStrands: Int8Array
  readTagColors: Uint32Array
  readChainHasSupp: Uint8Array | undefined
  numReads: number
  insertSizeStats?: { upper: number; lower: number }

  // CIGAR
  gapPositions: Uint32Array
  gapYs: Uint16Array
  gapTypes: Uint8Array
  gapFrequencies: Uint8Array
  numGaps: number
  mismatchPositions: Uint32Array
  mismatchYs: Uint16Array
  mismatchBases: Uint8Array
  mismatchFrequencies: Uint8Array
  numMismatches: number
  insertionPositions: Uint32Array
  insertionYs: Uint16Array
  insertionLengths: Uint16Array
  insertionFrequencies: Uint8Array
  numInsertions: number
  softclipPositions: Uint32Array
  softclipYs: Uint16Array
  softclipLengths: Uint16Array
  softclipFrequencies: Uint8Array
  numSoftclips: number
  hardclipPositions: Uint32Array
  hardclipYs: Uint16Array
  hardclipLengths: Uint16Array
  hardclipFrequencies: Uint8Array
  numHardclips: number
  softclipBasePositions: Uint32Array
  softclipBaseYs: Uint16Array
  softclipBaseBases: Uint8Array
  numSoftclipBases: number

  // Coverage — stored in GPU-compatible packed buffer formats
  coverageBuffer: ArrayBuffer
  coverageBinCount: number
  coverageMaxDepth: number
  snpBuffer: ArrayBuffer
  snpSegmentCount: number
  noncovBuffer: ArrayBuffer
  noncovSegmentCount: number
  noncovMaxCount: number
  indicatorBuffer: ArrayBuffer
  indicatorCount: number

  // Mod coverage — packed buffer: [position(f32), yOffset(f32), height(f32), rgba(u32)]
  modCovBuffer: ArrayBuffer
  modCovSegmentCount: number

  // Arcs
  arcX1: Uint32Array
  arcX2: Uint32Array
  arcColorTypes: Uint8Array
  arcShapeTypes: Uint8Array
  arcYBp: Uint32Array
  numArcs: number
  arcLinePositions: Uint32Array
  arcLineYs: Float32Array
  arcLineColorTypes: Uint8Array
  numArcLines: number

  // Connecting lines
  connectingLinePositions: Uint32Array
  connectingLineYs: Uint16Array
  numConnectingLines: number

  // Linked-read straight lines (linkedReadBezier mode)
  linkedReadLinePositions: Uint32Array
  linkedReadLineYs: Uint16Array
  linkedReadLineColorTypes: Uint8Array
  numLinkedReadLines: number
}

// Gap types from CIGAR
const GAP_DELETION = 0
const GAP_SKIP = 1

// Shared zero-length sentinels — Canvas2DRegionData is read-only after build,
// so all empty fields can share frozen instances instead of allocating
// per-region.
const EMPTY_U32 = new Uint32Array(0)
const EMPTY_U16 = new Uint16Array(0)
const EMPTY_U8 = new Uint8Array(0)
const EMPTY_F32 = new Float32Array(0)
const EMPTY_I8 = new Int8Array(0)
const EMPTY_BUF = new ArrayBuffer(0)

function buildReadFields(data: PileupDataResult) {
  const numReads = data.readIds.length
  return {
    readIdToIndex: buildReadIdToIndex(data.readIds, numReads),
    readPositions: data.readPositions,
    readYs: data.readYs,
    readFlags: data.readFlags,
    readMapqs: data.readMapqs,
    readAvgBaseQualities: data.readAvgBaseQualities,
    readInsertSizes: data.readInsertSizes,
    readPairOrientations: data.readPairOrientations,
    readStrands: data.readStrands,
    readTagColors: data.readTagColors,
    readChainHasSupp: data.readChainHasSupp,
    numReads,
    insertSizeStats: data.insertSizeStats,
  }
}

// Worker lays out interbases as (insertions, softclips, hardclips);
// each subrange is a `subarray` view over the merged typed arrays.
function buildCigarFields(data: CigarUploadData) {
  const { insEnd, scEnd, hcEnd } = interbaseRangeEnds(data)
  return {
    gapPositions: data.gapPositions,
    gapYs: data.gapYs,
    gapTypes: data.gapTypes,
    gapFrequencies: data.gapFrequencies,
    numGaps: data.gapPositions.length / 2,
    mismatchPositions: data.mismatchPositions,
    mismatchYs: data.mismatchYs,
    mismatchBases: data.mismatchBases,
    mismatchFrequencies: data.mismatchFrequencies,
    numMismatches: data.mismatchPositions.length,
    insertionPositions: data.interbasePositions.subarray(0, insEnd),
    insertionYs: data.interbaseYs.subarray(0, insEnd),
    insertionLengths: data.interbaseLengths.subarray(0, insEnd),
    insertionFrequencies: data.interbaseFrequencies.subarray(0, insEnd),
    numInsertions: data.numInsertions,
    softclipPositions: data.interbasePositions.subarray(insEnd, scEnd),
    softclipYs: data.interbaseYs.subarray(insEnd, scEnd),
    softclipLengths: data.interbaseLengths.subarray(insEnd, scEnd),
    softclipFrequencies: data.interbaseFrequencies.subarray(insEnd, scEnd),
    numSoftclips: data.numSoftclips,
    hardclipPositions: data.interbasePositions.subarray(scEnd, hcEnd),
    hardclipYs: data.interbaseYs.subarray(scEnd, hcEnd),
    hardclipLengths: data.interbaseLengths.subarray(scEnd, hcEnd),
    hardclipFrequencies: data.interbaseFrequencies.subarray(scEnd, hcEnd),
    numHardclips: data.numHardclips,
    softclipBasePositions: data.softclipBasePositions,
    softclipBaseYs: data.softclipBaseYs,
    softclipBaseBases: data.softclipBaseBases,
    numSoftclipBases: data.softclipBasePositions.length,
  }
}

function buildCoverageBins(data: CoverageUploadData) {
  const n = data.coverageDepths.length
  if (!(n > 0 && data.coverageMaxDepth > 0)) {
    return { coverageBuffer: EMPTY_BUF, coverageBinCount: 0 }
  }
  const { STRIDE_F32, FIELD } = CANVAS2D_COVERAGE
  const buf = new ArrayBuffer(n * STRIDE_F32 * 4)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  for (let i = 0; i < n; i++) {
    const off = i * STRIDE_F32
    u32[off + FIELD.position] = data.coverageStartPos + i
    f32[off + FIELD.bandBottom] = 0
    f32[off + FIELD.bandTop] = data.coverageDepths[i]!
  }
  return { coverageBuffer: buf, coverageBinCount: n }
}

function buildCoverageFields(data: CoverageUploadData) {
  const numSnpSegments = data.snpPositions.length
  const numNoncovSegments = data.noncovPositions.length
  const numIndicators = data.indicatorPositions.length
  const snp =
    numSnpSegments > 0
      ? packSnpSegmentsForCanvas2D(
          data.snpPositions,
          data.snpYOffsets,
          data.snpHeights,
          data.snpColorTypes,
          numSnpSegments,
        )
      : { buffer: EMPTY_BUF, segmentCount: 0 }
  const noncov =
    numNoncovSegments > 0
      ? packNoncovSegmentsForCanvas2D(
          data.noncovPositions,
          data.noncovYOffsets,
          data.noncovHeights,
          data.noncovColorTypes,
          numNoncovSegments,
        )
      : { buffer: EMPTY_BUF, segmentCount: 0 }
  const indicator =
    numIndicators > 0
      ? packIndicatorsForCanvas2D(
          data.indicatorPositions,
          data.indicatorColorTypes,
          numIndicators,
        )
      : { buffer: EMPTY_BUF, indicatorCount: 0 }
  return {
    ...buildCoverageBins(data),
    coverageMaxDepth: data.coverageMaxDepth,
    snpBuffer: snp.buffer,
    snpSegmentCount: snp.segmentCount,
    noncovBuffer: noncov.buffer,
    noncovSegmentCount: noncov.segmentCount,
    noncovMaxCount: data.noncovMaxCount,
    indicatorBuffer: indicator.buffer,
    indicatorCount: indicator.indicatorCount,
  }
}

function buildModCoverageFields(data: ModCoverageUploadData) {
  const numModCovSegments = data.modCovPositions.length
  const packed =
    numModCovSegments > 0
      ? packModCovSegmentsForCanvas2D(
          data.modCovPositions,
          data.modCovYOffsets,
          data.modCovHeights,
          data.modCovColors,
          numModCovSegments,
        )
      : { buffer: EMPTY_BUF, segmentCount: 0 }
  return {
    modCovBuffer: packed.buffer,
    modCovSegmentCount: packed.segmentCount,
  }
}

function buildArcsFields(data: ArcsUploadData | undefined) {
  if (!data) {
    return {
      arcX1: EMPTY_U32,
      arcX2: EMPTY_U32,
      arcColorTypes: EMPTY_U8,
      arcShapeTypes: EMPTY_U8,
      arcYBp: EMPTY_U32,
      numArcs: 0,
      arcLinePositions: EMPTY_U32,
      arcLineYs: EMPTY_F32,
      arcLineColorTypes: EMPTY_U8,
      numArcLines: 0,
    }
  }
  return {
    arcX1: data.arcX1,
    arcX2: data.arcX2,
    arcColorTypes: data.arcColorTypes,
    arcShapeTypes: data.arcShapeTypes,
    arcYBp: data.arcYBp,
    numArcs: data.numArcs,
    arcLinePositions: data.linePositions,
    arcLineYs: data.lineYs,
    arcLineColorTypes: data.lineColorTypes,
    numArcLines: data.numLines,
  }
}

function emptyPileupFields(): Omit<
  Canvas2DRegionData,
  | 'arcX1'
  | 'arcX2'
  | 'arcColorTypes'
  | 'arcShapeTypes'
  | 'arcYBp'
  | 'numArcs'
  | 'arcLinePositions'
  | 'arcLineYs'
  | 'arcLineColorTypes'
  | 'numArcLines'
> {
  return {
    readIdToIndex: new Map(),
    readPositions: EMPTY_U32,
    readYs: EMPTY_U16,
    readFlags: EMPTY_U16,
    readMapqs: EMPTY_U8,
    readAvgBaseQualities: EMPTY_U8,
    readInsertSizes: EMPTY_F32,
    readPairOrientations: EMPTY_U8,
    readStrands: EMPTY_I8,
    readTagColors: EMPTY_U32,
    readChainHasSupp: undefined,
    numReads: 0,
    gapPositions: EMPTY_U32,
    gapYs: EMPTY_U16,
    gapTypes: EMPTY_U8,
    gapFrequencies: EMPTY_U8,
    numGaps: 0,
    mismatchPositions: EMPTY_U32,
    mismatchYs: EMPTY_U16,
    mismatchBases: EMPTY_U8,
    mismatchFrequencies: EMPTY_U8,
    numMismatches: 0,
    insertionPositions: EMPTY_U32,
    insertionYs: EMPTY_U16,
    insertionLengths: EMPTY_U16,
    insertionFrequencies: EMPTY_U8,
    numInsertions: 0,
    softclipPositions: EMPTY_U32,
    softclipYs: EMPTY_U16,
    softclipLengths: EMPTY_U16,
    softclipFrequencies: EMPTY_U8,
    numSoftclips: 0,
    hardclipPositions: EMPTY_U32,
    hardclipYs: EMPTY_U16,
    hardclipLengths: EMPTY_U16,
    hardclipFrequencies: EMPTY_U8,
    numHardclips: 0,
    softclipBasePositions: EMPTY_U32,
    softclipBaseYs: EMPTY_U16,
    softclipBaseBases: EMPTY_U8,
    numSoftclipBases: 0,
    ...emptyModificationFields(),
    coverageBuffer: EMPTY_BUF,
    coverageBinCount: 0,
    coverageMaxDepth: 0,
    snpBuffer: EMPTY_BUF,
    snpSegmentCount: 0,
    noncovBuffer: EMPTY_BUF,
    noncovSegmentCount: 0,
    noncovMaxCount: 0,
    indicatorBuffer: EMPTY_BUF,
    indicatorCount: 0,
    modCovBuffer: EMPTY_BUF,
    modCovSegmentCount: 0,
    connectingLinePositions: EMPTY_U32,
    connectingLineYs: EMPTY_U16,
    numConnectingLines: 0,
    linkedReadLinePositions: EMPTY_U32,
    linkedReadLineYs: EMPTY_U16,
    linkedReadLineColorTypes: EMPTY_U8,
    numLinkedReadLines: 0,
  }
}

function buildPileupRegion(
  data: PileupDataResult,
  arcs: ArcsUploadData | undefined,
): Canvas2DRegionData {
  return {
    ...buildReadFields(data),
    ...buildCigarFields(data),
    ...buildModificationFields(data),
    ...buildCoverageFields(data),
    ...buildModCoverageFields(data),
    connectingLinePositions: data.connectingLinePositions,
    connectingLineYs: data.connectingLineYs,
    numConnectingLines: data.connectingLinePositions.length / 2,
    linkedReadLinePositions: data.linkedReadLinePositions ?? EMPTY_U32,
    linkedReadLineYs: data.linkedReadLineYs ?? EMPTY_U16,
    linkedReadLineColorTypes: data.linkedReadLineColorTypes ?? EMPTY_U8,
    numLinkedReadLines: data.numLinkedReadLines ?? 0,
    ...buildArcsFields(arcs),
  }
}

function buildArcsOnlyRegion(arcs: ArcsUploadData): Canvas2DRegionData {
  return {
    ...emptyPileupFields(),
    ...buildArcsFields(arcs),
  }
}

/**
 * Pure builder: turns the model's observable per-region inputs into the
 * regions map that `drawAlignmentBlocks` consumes. The on-screen
 * Canvas2DAlignmentsRenderer.sync calls this directly, so on-screen and
 * SVG export share one builder.
 */
export function buildAlignmentsRegionMap(
  laidOutPileupMap: ReadonlyMap<number, PileupDataResult>,
  arcsRpcDataMap: ReadonlyMap<number, ArcsUploadData>,
) {
  const regions = new Map<number, Canvas2DRegionData>()
  for (const [idx, data] of laidOutPileupMap) {
    regions.set(idx, buildPileupRegion(data, arcsRpcDataMap.get(idx)))
  }
  for (const [idx, arcs] of arcsRpcDataMap) {
    if (!regions.has(idx)) {
      regions.set(idx, buildArcsOnlyRegion(arcs))
    }
  }
  return regions
}

/**
 * One-shot pure entry point: build a regions map from observable sources
 * and paint into any 2D-context-shaped surface (real canvas for raster,
 * SvgCanvas for vector). Used by SVG export as a single call.
 */
export function drawAlignmentsToCtx(
  ctx: Ctx2D,
  sources: AlignmentsSources,
  blocks: RenderBlock[],
  state: RenderState,
) {
  return drawAlignmentBlocks(
    ctx,
    buildAlignmentsRegionMap(sources.laidOutPileupMap, sources.arcsRpcDataMap),
    blocks,
    state,
  )
}

/**
 * On-screen Canvas2D backend. Thin shell: `sync` rebuilds the regions map
 * via the same pure `buildAlignmentsRegionMap` the SVG path uses; on-screen
 * and export can't drift. `renderBlocks` paints via the pure
 * `drawAlignmentBlocks` entry point.
 */
export class Canvas2DAlignmentsRenderer implements AlignmentsBackend {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private regions: ReadonlyMap<number, Canvas2DRegionData> = new Map()

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas 2D context not available')
    }
    this.ctx = ctx
  }

  sync(sources: AlignmentsSources) {
    this.regions = buildAlignmentsRegionMap(
      sources.laidOutPileupMap,
      sources.arcsRpcDataMap,
    )
  }

  renderBlocks(blocks: RenderBlock[], state: RenderState) {
    prepareCanvas(this.canvas, this.ctx, state.canvasWidth, state.canvasHeight)
    return drawAlignmentBlocks(this.ctx, this.regions, blocks, state)
  }

  dispose() {
    this.regions = new Map()
  }
}

/**
 * Pure draw entry point. Takes any 2D-canvas-like context (real
 * CanvasRenderingContext2D or SvgCanvas) plus a prepared regions map and
 * paints the alignments display: arcs, coverage, pileup reads, mismatches,
 * insertions, soft/hard clips, modifications, and highlight/chain overlays.
 *
 * No `this`, no DOM, no DPR scaling — just data → ctx. The on-screen
 * Canvas2DAlignmentsRenderer wraps this with prepareCanvas + lifecycle
 * upload state; renderSvg.tsx calls it directly with an SvgCanvas.
 */
export function drawAlignmentBlocks(
  ctx: Ctx2D,
  regions: ReadonlyMap<number, Canvas2DRegionData>,
  blocks: RenderBlock[],
  state: RenderState,
) {
  const { canvasWidth, canvasHeight } = state

  if (regions.size === 0) {
    return false
  }

  const { effectiveArcsHeight, covH } = computeBlockHeights(state)
  const pileupTop = state.pileupTopOffset
  const mode = state.renderingMode ?? 'pileup'

  for (const block of blocks) {
    const region = regions.get(block.displayedRegionIndex)
    if (!region) {
      continue
    }

    const blockClip = clipBlockForCanvas(block, canvasWidth)
    if (!blockClip) {
      continue
    }

    const { fullBlockWidth, bpLength, scissorX, scissorW } = blockClip

    ctx.save()
    ctx.beginPath()
    ctx.rect(scissorX, 0, scissorW, canvasHeight)
    ctx.clip()

    if (effectiveArcsHeight > 0 && !state.pairedArcsDown && covH > 0) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(scissorX, 0, scissorW, covH)
      ctx.clip()
      drawArcs(
        ctx,
        region,
        block,
        bpLength,
        fullBlockWidth,
        state,
        0,
        covH,
        false,
      )
      ctx.restore()
    }

    if (state.showCoverage) {
      drawCoverage(ctx, region, block, bpLength, fullBlockWidth, state)
    }

    // Clip pileup area
    ctx.save()
    ctx.beginPath()
    ctx.rect(scissorX, pileupTop, scissorW, canvasHeight - pileupTop)
    ctx.clip()

    if (mode === 'linkedRead') {
      drawConnectingLines(ctx, region, block, bpLength, fullBlockWidth, state)
    } else if (mode === 'linkedReadBezier') {
      drawLinkedReadLines(ctx, region, block, bpLength, fullBlockWidth, state)
    }

    drawReads(ctx, region, block, bpLength, fullBlockWidth, state)

    if (state.showMismatches) {
      drawGaps(ctx, region, block, bpLength, fullBlockWidth, state)
      drawMismatches(ctx, region, block, bpLength, fullBlockWidth, state)
      drawInsertions(ctx, region, block, bpLength, fullBlockWidth, state)
    }

    drawClips(
      ctx,
      region.softclipPositions,
      region.softclipYs,
      region.softclipLengths,
      region.numSoftclips,
      rgb255(state.colors.colorSoftclip),
      block,
      bpLength,
      fullBlockWidth,
      state,
    )
    drawClips(
      ctx,
      region.hardclipPositions,
      region.hardclipYs,
      region.hardclipLengths,
      region.numHardclips,
      rgb255(state.colors.colorHardclip),
      block,
      bpLength,
      fullBlockWidth,
      state,
    )

    if (state.showSoftClipping) {
      drawSoftclipBases(ctx, region, block, bpLength, fullBlockWidth, state)
    }

    if (state.showModifications) {
      drawModifications(ctx, region, block, bpLength, fullBlockWidth, state)
    }

    drawHighlightOverlays(ctx, region, block, state)

    if (mode === 'linkedRead') {
      drawChainOverlays(ctx, region, block, state)
    }

    ctx.restore() // pileup clip

    if (effectiveArcsHeight > 0 && state.pairedArcsDown) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(scissorX, covH, scissorW, effectiveArcsHeight)
      ctx.clip()
      drawArcs(
        ctx,
        region,
        block,
        bpLength,
        fullBlockWidth,
        state,
        covH,
        effectiveArcsHeight,
        state.pairedArcsDown,
      )
      ctx.restore()
    }

    ctx.restore() // block clip
  }
  return true
}

function drawReads(
  ctx: Ctx2D,
  region: Canvas2DRegionData,
  block: { bpRangeX: [number, number]; screenStartPx: number },
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  const fH = state.featureHeight

  for (let i = 0; i < region.numReads; i++) {
    const startBp = region.readPositions[i * 2]!
    const endBp = region.readPositions[i * 2 + 1]!
    const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
    const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
    const y = pileupRowY(region.readYs[i]!, state)
    const w = Math.max(1, x2 - x1)

    ctx.fillStyle = getReadColor(i, region, state.colorScheme, state.colors, {
      renderingMode: state.renderingMode,
      flipStrandLongReadChains: state.flipStrandLongReadChains,
    })
    ctx.fillRect(x1, y, w, fH)

    if (state.showOutline && w > 2) {
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'
      ctx.lineWidth = 0.5
      ctx.strokeRect(x1, y, w, fH)
    }
  }
}

function drawGaps(
  ctx: Ctx2D,
  region: Canvas2DRegionData,
  block: { bpRangeX: [number, number]; screenStartPx: number },
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  const fH = state.featureHeight

  for (let i = 0; i < region.numGaps; i++) {
    const startBp = region.gapPositions[i * 2]!
    const endBp = region.gapPositions[i * 2 + 1]!
    const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
    const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
    const yRow = region.gapYs[i]!
    const y = pileupRowY(yRow, state)
    const gapType = region.gapTypes[i]!
    const w = Math.max(1, x2 - x1)

    if (gapType === GAP_DELETION) {
      // Deletion: dark line through read
      const midY = y + fH / 2
      ctx.fillStyle = rgb255(state.colors.colorDeletion)
      ctx.fillRect(x1, midY - 0.5, w, 1)
    } else if (gapType === GAP_SKIP) {
      // Skip/intron: thin line with lighter color
      ctx.fillStyle = rgb255(state.colors.colorSkip)
      // Erase the read body first
      ctx.clearRect(x1, y, w, fH)
      const midY = y + fH / 2
      ctx.fillRect(x1, midY - 0.5, w, 1)
    }
  }
}

function buildBaseColorMap(state: RenderState): Record<number, string> {
  const { colors } = state
  const mutedBase = rgb255(colors.colorMutedSnpBase)
  return state.showModifications
    ? { 65: mutedBase, 67: mutedBase, 71: mutedBase, 84: mutedBase }
    : {
        65: rgb255(colors.colorBaseA),
        67: rgb255(colors.colorBaseC),
        71: rgb255(colors.colorBaseG),
        84: rgb255(colors.colorBaseT),
      }
}

function drawMismatches(
  ctx: Ctx2D,
  region: Canvas2DRegionData,
  block: { bpRangeX: [number, number]; screenStartPx: number },
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  const fH = state.featureHeight
  const bpPerPx = bpLength / fullBlockWidth
  const baseColors = buildBaseColorMap(state)

  for (let i = 0; i < region.numMismatches; i++) {
    const bp = region.mismatchPositions[i]!
    const x = bpToScreenX(bp, block, bpLength, fullBlockWidth)
    const w = Math.max(1, 1 / bpPerPx)
    const yRow = region.mismatchYs[i]!
    const y = pileupRowY(yRow, state)
    const base = region.mismatchBases[i]!
    const color = baseColors[base]
    if (color) {
      ctx.fillStyle = color
      ctx.fillRect(x, y, w, fH)
    }
  }
}

function drawInsertions(
  ctx: Ctx2D,
  region: Canvas2DRegionData,
  block: { bpRangeX: [number, number]; screenStartPx: number },
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  const fH = state.featureHeight
  const insColor = rgb255(state.colors.colorInsertion)

  for (let i = 0; i < region.numInsertions; i++) {
    const bp = region.insertionPositions[i]!
    const x = bpToScreenX(bp, block, bpLength, fullBlockWidth)
    const yRow = region.insertionYs[i]!
    const y = pileupRowY(yRow, state)

    ctx.fillStyle = insColor
    // Insertion indicator: vertical line + small triangle
    ctx.fillRect(x - 0.5, y, 1, fH)
    // Top triangle
    ctx.beginPath()
    ctx.moveTo(x - 2, y)
    ctx.lineTo(x + 2, y)
    ctx.lineTo(x, y + 2)
    ctx.closePath()
    ctx.fill()
    // Bottom triangle
    ctx.beginPath()
    ctx.moveTo(x - 2, y + fH)
    ctx.lineTo(x + 2, y + fH)
    ctx.lineTo(x, y + fH - 2)
    ctx.closePath()
    ctx.fill()
  }
}

function drawClips(
  ctx: Ctx2D,
  positions: Uint32Array,
  ys: Uint16Array,
  lengths: Uint16Array,
  count: number,
  color: string,
  block: { bpRangeX: [number, number]; screenStartPx: number },
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  if (count === 0) {
    return
  }
  const fH = state.featureHeight
  const bpPerPx = bpLength / fullBlockWidth

  ctx.fillStyle = color
  for (let i = 0; i < count; i++) {
    const bp = positions[i]!
    const x = bpToScreenX(bp, block, bpLength, fullBlockWidth)
    const yRow = ys[i]!
    const y = pileupRowY(yRow, state)
    const len = lengths[i]!
    const w = Math.max(1, len / bpPerPx)
    ctx.fillRect(x, y, w, fH)
  }
}

function drawSoftclipBases(
  ctx: Ctx2D,
  region: Canvas2DRegionData,
  block: { bpRangeX: [number, number]; screenStartPx: number },
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  if (region.numSoftclipBases === 0) {
    return
  }
  const fH = state.featureHeight
  const bpPerPx = bpLength / fullBlockWidth
  const baseColors = buildBaseColorMap(state)

  for (let i = 0; i < region.numSoftclipBases; i++) {
    const bp = region.softclipBasePositions[i]!
    const x = bpToScreenX(bp, block, bpLength, fullBlockWidth)
    const w = Math.max(1, 1 / bpPerPx)
    const yRow = region.softclipBaseYs[i]!
    const y = pileupRowY(yRow, state)
    const base = region.softclipBaseBases[i]!
    const color = baseColors[base]
    if (color) {
      ctx.fillStyle = color
      ctx.fillRect(x, y, w, fH)
    }
  }
}

function drawCoverage(
  ctx: Ctx2D,
  region: Canvas2DRegionData,
  block: { bpRangeX: [number, number]; screenStartPx: number },
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  const covH = state.coverageHeight
  const covColor = rgb255(state.colors.colorCoverage)
  const bpToX = (bp: number) => bpToScreenX(bp, block, bpLength, fullBlockWidth)
  const viewWidth = fullBlockWidth + block.screenStartPx

  const snpColors = {
    baseA: rgb255(state.colors.colorBaseA),
    baseC: rgb255(state.colors.colorBaseC),
    baseG: rgb255(state.colors.colorBaseG),
    baseT: rgb255(state.colors.colorBaseT),
    mismatch: '',
    deletion: rgb255(state.colors.colorDeletion),
    insertion: '',
  }

  const noncovColors = {
    insertion: rgb255(state.colors.colorInsertion),
    softclip: rgb255(state.colors.colorSoftclip),
    hardclip: rgb255(state.colors.colorHardclip),
  }

  const domainMax = state.coverageMaxDepth
  if (!domainMax) {
    return
  }
  drawCoverageBins(
    ctx,
    region.coverageBuffer,
    region.coverageBinCount,
    makeScoreNormalizer(0, domainMax, state.coverageIsLog),
    covH,
    covColor,
    bpToX,
    viewWidth,
  )
  const snpDepthScale = region.coverageMaxDepth / domainMax
  drawSnpSegments(
    ctx,
    region.snpBuffer,
    region.snpSegmentCount,
    snpDepthScale,
    covH,
    snpColors,
    bpToX,
    viewWidth,
  )
  drawModCovSegments(
    ctx,
    region.modCovBuffer,
    region.modCovSegmentCount,
    snpDepthScale,
    covH,
    bpToX,
    viewWidth,
  )
  drawNoncovSegments(
    ctx,
    region.noncovBuffer,
    region.noncovSegmentCount,
    region.noncovMaxCount,
    noncovColors,
    bpToX,
    viewWidth,
  )
  drawIndicators(
    ctx,
    region.indicatorBuffer,
    region.indicatorCount,
    noncovColors,
    bpToX,
    viewWidth,
  )
}

function drawArcs(
  ctx: Ctx2D,
  region: Canvas2DRegionData,
  block: { bpRangeX: [number, number]; screenStartPx: number },
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
  arcsTop: number,
  arcsH: number,
  pairedArcsDown: boolean,
) {
  // Samplot autoscales via state.arcsYDomainBp; arc mode falls back to the
  // bp-span that fits availH at the current zoom.
  const availH = arcsH - 2
  const pxPerBp = fullBlockWidth / bpLength
  const fallbackDomain = pxPerBp > 0 ? availH / pxPerBp : 1
  drawArcsToCtx(ctx, region, {
    bpToScreenX: bp => bpToScreenX(bp, block, bpLength, fullBlockWidth),
    arcsYDomainBp: state.arcsYDomainBp ?? fallbackDomain,
    arcsTop,
    arcsH,
    pairedArcsDown,
    lineWidth: state.arcLineWidth ?? 1,
    palette: getArcPalette(state.arcColorByType),
  })

  for (let i = 0; i < region.numArcLines; i++) {
    const bp = region.arcLinePositions[i]!
    const x = bpToScreenX(bp, block, bpLength, fullBlockWidth)
    const y = arcsTop + region.arcLineYs[i]! * arcsH
    const colorIdx = region.arcLineColorTypes[i]!

    ctx.fillStyle = rgb255(
      arcLineColorPalette[colorIdx % arcLineColorPalette.length]!,
    )
    ctx.fillRect(x - 1, y - 1, 2, 2)
  }
}

function drawConnectingLines(
  ctx: Ctx2D,
  region: Canvas2DRegionData,
  block: { bpRangeX: [number, number]; screenStartPx: number },
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  if (region.numConnectingLines === 0) {
    return
  }
  const fH = state.featureHeight

  ctx.strokeStyle = 'rgba(0,0,0,0.3)'
  ctx.lineWidth = 1

  for (let i = 0; i < region.numConnectingLines; i++) {
    const startBp = region.connectingLinePositions[i * 2]!
    const endBp = region.connectingLinePositions[i * 2 + 1]!
    const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
    const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
    const yRow = region.connectingLineYs[i]!
    const y = pileupRowY(yRow, state) + fH / 2

    ctx.beginPath()
    ctx.moveTo(x1, y)
    ctx.lineTo(x2, y)
    ctx.stroke()
  }
}

function drawLinkedReadLines(
  ctx: Ctx2D,
  region: Canvas2DRegionData,
  block: { bpRangeX: [number, number]; screenStartPx: number },
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  if (region.numLinkedReadLines === 0) {
    return
  }
  const fH = state.featureHeight
  ctx.lineWidth = 1.5
  for (let i = 0; i < region.numLinkedReadLines; i++) {
    const startBp = region.linkedReadLinePositions[i * 2]!
    const endBp = region.linkedReadLinePositions[i * 2 + 1]!
    const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
    const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
    const y1 = pileupRowY(region.linkedReadLineYs[i * 2]!, state) + fH / 2
    const y2 = pileupRowY(region.linkedReadLineYs[i * 2 + 1]!, state) + fH / 2
    const colorIdx =
      region.linkedReadLineColorTypes[i]! % linkedReadColorPalette.length
    ctx.strokeStyle = rgb255(linkedReadColorPalette[colorIdx]!)
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
}

function drawHighlightOverlays(
  ctx: Ctx2D,
  region: Canvas2DRegionData,
  block: {
    bpRangeX: [number, number]
    screenStartPx: number
    screenEndPx: number
  },
  state: RenderState,
) {
  const fH = state.featureHeight
  const bpLength = block.bpRangeX[1] - block.bpRangeX[0]
  const fullBlockWidth = block.screenEndPx - block.screenStartPx

  if (state.highlightedChainIds.length === 0 && state.highlightedFeatureId) {
    const idx = region.readIdToIndex.get(state.highlightedFeatureId)
    if (idx !== undefined && idx < region.numReads) {
      const startBp = region.readPositions[idx * 2]!
      const endBp = region.readPositions[idx * 2 + 1]!
      const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
      const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
      const y = pileupRowY(region.readYs[idx]!, state)
      ctx.fillStyle = 'rgba(0,0,0,0.15)'
      ctx.fillRect(x1, y, x2 - x1, fH)
    }
  }

  if (state.selectedChainIds.length === 0 && state.selectedFeatureId) {
    const idx = region.readIdToIndex.get(state.selectedFeatureId)
    if (idx !== undefined && idx < region.numReads) {
      const startBp = region.readPositions[idx * 2]!
      const endBp = region.readPositions[idx * 2 + 1]!
      const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
      const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
      const y = pileupRowY(region.readYs[idx]!, state)
      ctx.strokeStyle = '#00b8ff'
      ctx.lineWidth = 2
      ctx.strokeRect(x1, y, x2 - x1, fH)
    }
  }
}

function drawChainOverlays(
  ctx: Ctx2D,
  region: Canvas2DRegionData,
  block: {
    bpRangeX: [number, number]
    screenStartPx: number
    screenEndPx: number
  },
  state: RenderState,
) {
  const fH = state.featureHeight
  const bpLength = block.bpRangeX[1] - block.bpRangeX[0]
  const fullBlockWidth = block.screenEndPx - block.screenStartPx

  if (state.highlightedChainIds.length > 0) {
    const bounds = getChainBounds(state.highlightedChainIds, region)
    if (bounds) {
      const startBp = bounds.minStart
      const endBp = bounds.maxEnd
      const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
      const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
      const y = pileupRowY(bounds.y, state)
      ctx.fillStyle = 'rgba(0,0,0,0.4)'
      ctx.fillRect(x1, y, x2 - x1, fH)
    }
  }

  if (state.selectedChainIds.length > 0) {
    const bounds = getChainBounds(state.selectedChainIds, region)
    if (bounds) {
      const startBp = bounds.minStart
      const endBp = bounds.maxEnd
      const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
      const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
      const y = pileupRowY(bounds.y, state)
      ctx.strokeStyle = '#00b8ff'
      ctx.lineWidth = 2
      ctx.strokeRect(x1, y, x2 - x1, fH)
    }
  }
}
