import {
  BASE_A_COLOR,
  BASE_C_COLOR,
  BASE_G_COLOR,
  BASE_T_COLOR,
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
import { pruneRegionMap } from '@jbrowse/core/gpu/pruneRegionMap'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import { makeScoreNormalizer } from '@jbrowse/wiggle-core'

import { getReadColor, rgb255 } from '../colorUtils.ts'
import { getChainBounds } from './chainOverlayUtils.ts'
import { arcColorPalette, arcLineColorPalette } from './shaders/palettes.ts'

import type {
  AlignmentsBackend,
  ArcsUploadData,
  CigarUploadData,
  ConnectingLinesUploadData,
  CoverageUploadData,
  ModCoverageUploadData,
  ModificationUploadData,
  ReadUploadData,
  RenderBlock,
  RenderState,
} from './rendererTypes.ts'
import type { PileupDataResult } from '../../RenderPileupDataRPC/types.ts'

interface Canvas2DRegionData {
  regionStart: number
  readIdToIndex: Map<string, number>
  readPositions: Uint32Array
  readYs: Uint16Array
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

  // Modifications
  modificationPositions: Uint32Array
  modificationYs: Uint16Array
  modificationColors: Uint32Array
  numModifications: number

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
  arcX1: Float32Array
  arcX2: Float32Array
  arcColorTypes: Float32Array
  arcIsArc: Uint8Array
  numArcs: number
  arcLinePositions: Uint32Array
  arcLineYs: Float32Array
  arcLineColorTypes: Float32Array
  numArcLines: number

  // Connecting lines
  connectingLinePositions: Uint32Array
  connectingLineYs: Uint16Array
  numConnectingLines: number
}

// Gap types from CIGAR
const GAP_DELETION = 0
const GAP_SKIP = 1

// Linear interpolation from an absolute bp position into the block's screen-
// pixel x. `reversed` blocks flip the mapping (low-bp edge on the right).
function bpToScreenX(
  absBp: number,
  block: {
    bpRangeX: [number, number]
    screenStartPx: number
    reversed?: boolean
  },
  bpLength: number,
  fullBlockWidth: number,
) {
  const bpEdge = block.reversed ? block.bpRangeX[1] : block.bpRangeX[0]
  const offset = block.reversed ? bpEdge - absBp : absBp - bpEdge
  return block.screenStartPx + (offset / bpLength) * fullBlockWidth
}

const BASE_COLORS: Record<number, string> = {
  0: BASE_A_COLOR,
  1: BASE_C_COLOR,
  2: BASE_G_COLOR,
  3: BASE_T_COLOR,
}

function emptyRegion(regionStart: number): Canvas2DRegionData {
  const empty32 = new Uint32Array(0)
  const empty16 = new Uint16Array(0)
  const empty8 = new Uint8Array(0)
  const emptyF32 = new Float32Array(0)
  return {
    regionStart,
    readIdToIndex: new Map(),
    readPositions: empty32,
    readYs: empty16,
    readFlags: empty16,
    readMapqs: empty8,
    readAvgBaseQualities: empty8,
    readInsertSizes: emptyF32,
    readPairOrientations: empty8,
    readStrands: new Int8Array(0),
    readTagColors: empty32,
    readChainHasSupp: undefined,
    numReads: 0,
    gapPositions: empty32,
    gapYs: empty16,
    gapTypes: empty8,
    gapFrequencies: empty8,
    numGaps: 0,
    mismatchPositions: empty32,
    mismatchYs: empty16,
    mismatchBases: empty8,
    mismatchFrequencies: empty8,
    numMismatches: 0,
    insertionPositions: empty32,
    insertionYs: empty16,
    insertionLengths: empty16,
    insertionFrequencies: empty8,
    numInsertions: 0,
    softclipPositions: empty32,
    softclipYs: empty16,
    softclipLengths: empty16,
    softclipFrequencies: empty8,
    numSoftclips: 0,
    hardclipPositions: empty32,
    hardclipYs: empty16,
    hardclipLengths: empty16,
    hardclipFrequencies: empty8,
    numHardclips: 0,
    softclipBasePositions: empty32,
    softclipBaseYs: empty16,
    softclipBaseBases: empty8,
    numSoftclipBases: 0,
    modificationPositions: empty32,
    modificationYs: empty16,
    modificationColors: empty32,
    numModifications: 0,
    coverageBuffer: new ArrayBuffer(0),
    coverageBinCount: 0,
    coverageMaxDepth: 0,
    snpBuffer: new ArrayBuffer(0),
    snpSegmentCount: 0,
    noncovBuffer: new ArrayBuffer(0),
    noncovSegmentCount: 0,
    noncovMaxCount: 0,
    indicatorBuffer: new ArrayBuffer(0),
    indicatorCount: 0,
    modCovBuffer: new ArrayBuffer(0),
    modCovSegmentCount: 0,
    arcX1: emptyF32,
    arcX2: emptyF32,
    arcColorTypes: emptyF32,
    arcIsArc: empty8,
    numArcs: 0,
    arcLinePositions: empty32,
    arcLineYs: emptyF32,
    arcLineColorTypes: emptyF32,
    numArcLines: 0,
    connectingLinePositions: empty32,
    connectingLineYs: empty16,
    numConnectingLines: 0,
  }
}

export class Canvas2DAlignmentsRenderer implements AlignmentsBackend {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private regions = new Map<number, Canvas2DRegionData>()

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas 2D context not available')
    }
    this.ctx = ctx
  }

  uploadRegion(displayedRegionIndex: number, data: PileupDataResult) {
    this.uploadFromTypedArraysForRegion(displayedRegionIndex, data)
    this.uploadCigarFromTypedArraysForRegion(displayedRegionIndex, data)
    this.uploadModificationsFromTypedArraysForRegion(displayedRegionIndex, data)
    this.uploadCoverageFromTypedArraysForRegion(displayedRegionIndex, data)
    this.uploadModCoverageFromTypedArraysForRegion(displayedRegionIndex, data)
  }

  uploadFromTypedArraysForRegion(
    displayedRegionIndex: number,
    data: ReadUploadData,
  ) {
    let r = this.regions.get(displayedRegionIndex)
    if (!r) {
      r = emptyRegion(data.regionStart)
      this.regions.set(displayedRegionIndex, r)
    }
    r.regionStart = data.regionStart
    r.readPositions = data.readPositions
    r.readYs = data.readYs
    r.readFlags = data.readFlags
    r.readMapqs = data.readMapqs
    r.readAvgBaseQualities = data.readAvgBaseQualities
    r.readInsertSizes = data.readInsertSizes
    r.readPairOrientations = data.readPairOrientations
    r.readStrands = data.readStrands
    r.readTagColors = data.readTagColors
    r.readChainHasSupp = data.readChainHasSupp
    r.numReads = data.numReads
    r.insertSizeStats = data.insertSizeStats
    r.readIdToIndex = new Map()
    for (let i = 0; i < data.numReads; i++) {
      r.readIdToIndex.set(data.readIds[i]!, i)
    }
  }

  uploadCigarFromTypedArraysForRegion(
    displayedRegionIndex: number,
    data: CigarUploadData,
  ) {
    const r = this.regions.get(displayedRegionIndex)
    if (!r) {
      return
    }
    r.gapPositions = data.gapPositions
    r.gapYs = data.gapYs
    r.gapTypes = data.gapTypes
    r.gapFrequencies = data.gapFrequencies
    r.numGaps = data.numGaps
    r.mismatchPositions = data.mismatchPositions
    r.mismatchYs = data.mismatchYs
    r.mismatchBases = data.mismatchBases
    r.mismatchFrequencies = data.mismatchFrequencies
    r.numMismatches = data.numMismatches

    // Worker lays out interbases as (insertions, softclips, hardclips);
    // slice each subrange directly off the merged typed arrays.
    const insEnd = data.numInsertions
    const scEnd = insEnd + data.numSoftclips
    const hcEnd = scEnd + data.numHardclips

    r.insertionPositions = data.interbasePositions.subarray(0, insEnd)
    r.insertionYs = data.interbaseYs.subarray(0, insEnd)
    r.insertionLengths = data.interbaseLengths.subarray(0, insEnd)
    r.insertionFrequencies = data.interbaseFrequencies.subarray(0, insEnd)
    r.numInsertions = data.numInsertions

    r.softclipPositions = data.interbasePositions.subarray(insEnd, scEnd)
    r.softclipYs = data.interbaseYs.subarray(insEnd, scEnd)
    r.softclipLengths = data.interbaseLengths.subarray(insEnd, scEnd)
    r.softclipFrequencies = data.interbaseFrequencies.subarray(insEnd, scEnd)
    r.numSoftclips = data.numSoftclips

    r.hardclipPositions = data.interbasePositions.subarray(scEnd, hcEnd)
    r.hardclipYs = data.interbaseYs.subarray(scEnd, hcEnd)
    r.hardclipLengths = data.interbaseLengths.subarray(scEnd, hcEnd)
    r.hardclipFrequencies = data.interbaseFrequencies.subarray(scEnd, hcEnd)
    r.numHardclips = data.numHardclips

    r.softclipBasePositions = data.softclipBasePositions
    r.softclipBaseYs = data.softclipBaseYs
    r.softclipBaseBases = data.softclipBaseBases
    r.numSoftclipBases = data.numSoftclipBases
  }

  uploadModificationsFromTypedArraysForRegion(
    displayedRegionIndex: number,
    data: ModificationUploadData,
  ) {
    const r = this.regions.get(displayedRegionIndex)
    if (!r) {
      return
    }
    r.modificationPositions = data.modificationPositions
    r.modificationYs = data.modificationYs
    r.modificationColors = data.modificationColors
    r.numModifications = data.numModifications
  }

  uploadCoverageFromTypedArraysForRegion(
    displayedRegionIndex: number,
    data: CoverageUploadData,
  ) {
    const r = this.regions.get(displayedRegionIndex)
    if (!r) {
      return
    }

    r.coverageMaxDepth = data.coverageMaxDepth

    if (data.numCoverageBins > 0 && data.coverageMaxDepth > 0) {
      const n = data.numCoverageBins
      const { STRIDE_F32, FIELD } = CANVAS2D_COVERAGE
      const buf = new ArrayBuffer(n * STRIDE_F32 * 4)
      const u32 = new Uint32Array(buf)
      const f32 = new Float32Array(buf)
      for (let i = 0; i < n; i++) {
        const off = i * STRIDE_F32
        u32[off + FIELD.position] = data.coverageStartOffset + i + r.regionStart
        f32[off + FIELD.bandBottom] = 0
        f32[off + FIELD.bandTop] = data.coverageDepths[i]!
      }
      r.coverageBuffer = buf
      r.coverageBinCount = n
    }

    if (data.numSnpSegments > 0) {
      const packed = packSnpSegmentsForCanvas2D(
        data.snpPositions,
        data.snpYOffsets,
        data.snpHeights,
        data.snpColorTypes,
        data.numSnpSegments,
      )
      r.snpBuffer = packed.buffer
      r.snpSegmentCount = packed.segmentCount
    }

    if (data.numNoncovSegments > 0) {
      const packed = packNoncovSegmentsForCanvas2D(
        data.noncovPositions,
        data.noncovYOffsets,
        data.noncovHeights,
        data.noncovColorTypes,
        data.numNoncovSegments,
      )
      r.noncovBuffer = packed.buffer
      r.noncovSegmentCount = packed.segmentCount
    }
    r.noncovMaxCount = data.noncovMaxCount

    if (data.numIndicators > 0) {
      const packed = packIndicatorsForCanvas2D(
        data.indicatorPositions,
        data.indicatorColorTypes,
        data.numIndicators,
      )
      r.indicatorBuffer = packed.buffer
      r.indicatorCount = packed.indicatorCount
    }
  }

  uploadModCoverageFromTypedArraysForRegion(
    displayedRegionIndex: number,
    data: ModCoverageUploadData,
  ) {
    const r = this.regions.get(displayedRegionIndex)
    if (!r) {
      return
    }
    if (data.numModCovSegments > 0) {
      const packed = packModCovSegmentsForCanvas2D(
        data.modCovPositions,
        data.modCovYOffsets,
        data.modCovHeights,
        data.modCovColors,
        data.numModCovSegments,
      )
      r.modCovBuffer = packed.buffer
      r.modCovSegmentCount = packed.segmentCount
    }
  }

  uploadArcsFromTypedArraysForRegion(
    displayedRegionIndex: number,
    data: ArcsUploadData,
  ) {
    let r = this.regions.get(displayedRegionIndex)
    if (!r) {
      r = emptyRegion(data.regionStart)
      this.regions.set(displayedRegionIndex, r)
    }
    r.arcX1 = data.arcX1
    r.arcX2 = data.arcX2
    r.arcColorTypes = data.arcColorTypes
    r.arcIsArc = data.arcIsArc
    r.numArcs = data.numArcs
    r.arcLinePositions = data.linePositions
    r.arcLineYs = data.lineYs
    r.arcLineColorTypes = data.lineColorTypes
    r.numArcLines = data.numLines
  }

  uploadConnectingLinesForRegion(
    displayedRegionIndex: number,
    data: ConnectingLinesUploadData,
  ) {
    let r = this.regions.get(displayedRegionIndex)
    if (!r) {
      r = emptyRegion(data.regionStart)
      this.regions.set(displayedRegionIndex, r)
    }
    r.connectingLinePositions = data.connectingLinePositions
    r.connectingLineYs = data.connectingLineYs
    r.numConnectingLines = data.numConnectingLines
  }

  pruneRegions(activeRegions: number[]) {
    pruneRegionMap(this.regions, activeRegions)
  }

  renderBlocks(blocks: RenderBlock[], state: RenderState) {
    const { canvasWidth, canvasHeight } = state

    const ctx = this.ctx
    prepareCanvas(this.canvas, ctx, canvasWidth, canvasHeight)

    if (this.regions.size === 0) {
      return
    }

    const effectiveArcsHeight =
      state.showArcs && state.arcsHeight ? state.arcsHeight : 0
    const covH = state.showCoverage ? state.coverageHeight : 0
    const pileupTop = state.pileupTopOffset
    const mode = state.renderingMode ?? 'pileup'

    for (const block of blocks) {
      const region = this.regions.get(block.displayedRegionIndex)
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
        this.drawArcs(
          ctx,
          region,
          block,
          bpLength,
          fullBlockWidth,
          state,
          0,
          covH,
          true,
        )
        ctx.restore()
      }

      if (state.showCoverage) {
        this.drawCoverage(ctx, region, block, bpLength, fullBlockWidth, state)
      }

      // Clip pileup area
      ctx.save()
      ctx.beginPath()
      ctx.rect(scissorX, pileupTop, scissorW, canvasHeight - pileupTop)
      ctx.clip()

      if (mode === 'linkedRead') {
        this.drawConnectingLines(
          ctx,
          region,
          block,
          bpLength,
          fullBlockWidth,
          state,
        )
      }

      this.drawReads(ctx, region, block, bpLength, fullBlockWidth, state)

      if (state.showMismatches) {
        this.drawGaps(ctx, region, block, bpLength, fullBlockWidth, state)
        this.drawMismatches(ctx, region, block, bpLength, fullBlockWidth, state)
        this.drawInsertions(ctx, region, block, bpLength, fullBlockWidth, state)
      }

      this.drawClips(
        ctx,
        region.softclipPositions,
        region.softclipYs,
        region.softclipLengths,
        region.numSoftclips,
        region.regionStart,
        rgb255(state.colors.colorSoftclip),
        block,
        bpLength,
        fullBlockWidth,
        state,
      )
      this.drawClips(
        ctx,
        region.hardclipPositions,
        region.hardclipYs,
        region.hardclipLengths,
        region.numHardclips,
        region.regionStart,
        rgb255(state.colors.colorHardclip),
        block,
        bpLength,
        fullBlockWidth,
        state,
      )

      if (state.showSoftClipping) {
        this.drawSoftclipBases(
          ctx,
          region,
          block,
          bpLength,
          fullBlockWidth,
          state,
        )
      }

      if (state.showModifications) {
        this.drawModifications(
          ctx,
          region,
          block,
          bpLength,
          fullBlockWidth,
          state,
        )
      }

      // Feature highlight/selection overlays
      this.drawHighlightOverlays(ctx, region, block, state)

      if (mode === 'linkedRead') {
        this.drawChainOverlays(ctx, region, block, state)
      }

      ctx.restore() // pileup clip

      if (effectiveArcsHeight > 0 && state.pairedArcsDown) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(scissorX, covH, scissorW, effectiveArcsHeight)
        ctx.clip()
        this.drawArcs(
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
  }

  private drawReads(
    ctx: CanvasRenderingContext2D,
    region: Canvas2DRegionData,
    block: { bpRangeX: [number, number]; screenStartPx: number },
    bpLength: number,
    fullBlockWidth: number,
    state: RenderState,
  ) {
    const covOffset = state.pileupTopOffset
    const fH = state.featureHeight
    const fSpacing = state.featureSpacing

    for (let i = 0; i < region.numReads; i++) {
      const startBp = region.readPositions[i * 2]! + region.regionStart
      const endBp = region.readPositions[i * 2 + 1]! + region.regionStart
      const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
      const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
      const y =
        region.readYs[i]! * (fH + fSpacing) + covOffset - state.rangeY[0]
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

  private drawGaps(
    ctx: CanvasRenderingContext2D,
    region: Canvas2DRegionData,
    block: { bpRangeX: [number, number]; screenStartPx: number },
    bpLength: number,
    fullBlockWidth: number,
    state: RenderState,
  ) {
    const covOffset = state.pileupTopOffset
    const fH = state.featureHeight
    const fSpacing = state.featureSpacing

    for (let i = 0; i < region.numGaps; i++) {
      const startBp = region.gapPositions[i * 2]! + region.regionStart
      const endBp = region.gapPositions[i * 2 + 1]! + region.regionStart
      const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
      const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
      const yRow = region.gapYs[i]!
      const y = yRow * (fH + fSpacing) + covOffset - state.rangeY[0]
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

  private drawMismatches(
    ctx: CanvasRenderingContext2D,
    region: Canvas2DRegionData,
    block: { bpRangeX: [number, number]; screenStartPx: number },
    bpLength: number,
    fullBlockWidth: number,
    state: RenderState,
  ) {
    const covOffset = state.pileupTopOffset
    const fH = state.featureHeight
    const fSpacing = state.featureSpacing
    const bpPerPx = bpLength / fullBlockWidth

    for (let i = 0; i < region.numMismatches; i++) {
      const bp = region.mismatchPositions[i]! + region.regionStart
      const x = bpToScreenX(bp, block, bpLength, fullBlockWidth)
      const w = Math.max(1, 1 / bpPerPx)
      const yRow = region.mismatchYs[i]!
      const y = yRow * (fH + fSpacing) + covOffset - state.rangeY[0]
      const base = region.mismatchBases[i]!
      const color = BASE_COLORS[base] ?? '#999'
      ctx.fillStyle = color
      ctx.fillRect(x, y, w, fH)
    }
  }

  private drawInsertions(
    ctx: CanvasRenderingContext2D,
    region: Canvas2DRegionData,
    block: { bpRangeX: [number, number]; screenStartPx: number },
    bpLength: number,
    fullBlockWidth: number,
    state: RenderState,
  ) {
    const covOffset = state.pileupTopOffset
    const fH = state.featureHeight
    const fSpacing = state.featureSpacing
    const insColor = rgb255(state.colors.colorInsertion)

    for (let i = 0; i < region.numInsertions; i++) {
      const bp = region.insertionPositions[i]! + region.regionStart
      const x = bpToScreenX(bp, block, bpLength, fullBlockWidth)
      const yRow = region.insertionYs[i]!
      const y = yRow * (fH + fSpacing) + covOffset - state.rangeY[0]

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

  private drawClips(
    ctx: CanvasRenderingContext2D,
    positions: Uint32Array,
    ys: Uint16Array,
    lengths: Uint16Array,
    count: number,
    regionStart: number,
    color: string,
    block: { bpRangeX: [number, number]; screenStartPx: number },
    bpLength: number,
    fullBlockWidth: number,
    state: RenderState,
  ) {
    if (count === 0) {
      return
    }
    const covOffset = state.pileupTopOffset
    const fH = state.featureHeight
    const fSpacing = state.featureSpacing
    const bpPerPx = bpLength / fullBlockWidth

    ctx.fillStyle = color
    for (let i = 0; i < count; i++) {
      const bp = positions[i]! + regionStart
      const x = bpToScreenX(bp, block, bpLength, fullBlockWidth)
      const yRow = ys[i]!
      const y = yRow * (fH + fSpacing) + covOffset - state.rangeY[0]
      const len = lengths[i]!
      const w = Math.max(1, len / bpPerPx)
      ctx.fillRect(x, y, w, fH)
    }
  }

  private drawSoftclipBases(
    ctx: CanvasRenderingContext2D,
    region: Canvas2DRegionData,
    block: { bpRangeX: [number, number]; screenStartPx: number },
    bpLength: number,
    fullBlockWidth: number,
    state: RenderState,
  ) {
    if (region.numSoftclipBases === 0) {
      return
    }
    const covOffset = state.pileupTopOffset
    const fH = state.featureHeight
    const fSpacing = state.featureSpacing
    const bpPerPx = bpLength / fullBlockWidth

    for (let i = 0; i < region.numSoftclipBases; i++) {
      const bp = region.softclipBasePositions[i]! + region.regionStart
      const x = bpToScreenX(bp, block, bpLength, fullBlockWidth)
      const w = Math.max(1, 1 / bpPerPx)
      const yRow = region.softclipBaseYs[i]!
      const y = yRow * (fH + fSpacing) + covOffset - state.rangeY[0]
      const base = region.softclipBaseBases[i]!
      const color = BASE_COLORS[base] ?? '#999'
      ctx.fillStyle = color
      ctx.fillRect(x, y, w, fH)
    }
  }

  private drawModifications(
    ctx: CanvasRenderingContext2D,
    region: Canvas2DRegionData,
    block: { bpRangeX: [number, number]; screenStartPx: number },
    bpLength: number,
    fullBlockWidth: number,
    state: RenderState,
  ) {
    if (region.numModifications === 0) {
      return
    }
    const covOffset = state.pileupTopOffset
    const fH = state.featureHeight
    const fSpacing = state.featureSpacing
    const bpPerPx = bpLength / fullBlockWidth

    for (let i = 0; i < region.numModifications; i++) {
      const bp = region.modificationPositions[i]! + region.regionStart
      const x = bpToScreenX(bp, block, bpLength, fullBlockWidth)
      const w = Math.max(1, 1 / bpPerPx)
      const yRow = region.modificationYs[i]!
      const y = yRow * (fH + fSpacing) + covOffset - state.rangeY[0]
      ctx.fillStyle = abgrToCssRgba(region.modificationColors[i]!)
      ctx.fillRect(x, y, w, fH)
    }
  }

  private drawCoverage(
    ctx: CanvasRenderingContext2D,
    region: Canvas2DRegionData,
    block: { bpRangeX: [number, number]; screenStartPx: number },
    bpLength: number,
    fullBlockWidth: number,
    state: RenderState,
  ) {
    const covH = state.coverageHeight
    const covColor = rgb255(state.colors.colorCoverage)
    const bpToX = (bp: number) =>
      bpToScreenX(bp, block, bpLength, fullBlockWidth)
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

  private paletteColor(palette: [number, number, number][], idx: number) {
    return rgb255(palette[idx % palette.length]!)
  }

  private drawArcs(
    ctx: CanvasRenderingContext2D,
    region: Canvas2DRegionData,
    block: { bpRangeX: [number, number]; screenStartPx: number },
    bpLength: number,
    fullBlockWidth: number,
    state: RenderState,
    arcsTop: number,
    arcsH: number,
    pairedArcsDown: boolean,
  ) {
    const lineWidth = state.arcLineWidth ?? 1

    for (let i = 0; i < region.numArcs; i++) {
      const x1Bp = region.arcX1[i]! + region.regionStart
      const x2Bp = region.arcX2[i]! + region.regionStart
      const colorIdx = Math.round(region.arcColorTypes[i]!)

      const sx1 = bpToScreenX(x1Bp, block, bpLength, fullBlockWidth)
      const sx2 = bpToScreenX(x2Bp, block, bpLength, fullBlockWidth)
      const midX = (sx1 + sx2) / 2
      const span = Math.abs(sx2 - sx1)
      const arcH = Math.min(span * 0.5, arcsH - 2)

      ctx.strokeStyle = this.paletteColor(arcColorPalette, colorIdx)
      ctx.lineWidth = lineWidth
      ctx.beginPath()
      if (pairedArcsDown) {
        ctx.moveTo(sx1, arcsTop + arcsH)
        ctx.quadraticCurveTo(midX, arcsTop + arcsH - arcH, sx2, arcsTop + arcsH)
      } else {
        ctx.moveTo(sx1, arcsTop)
        ctx.quadraticCurveTo(midX, arcsTop + arcH, sx2, arcsTop)
      }
      ctx.stroke()
    }

    for (let i = 0; i < region.numArcLines; i++) {
      const bp = region.arcLinePositions[i]! + region.regionStart
      const x = bpToScreenX(bp, block, bpLength, fullBlockWidth)
      const y = arcsTop + region.arcLineYs[i]! * arcsH
      const colorIdx = Math.round(region.arcLineColorTypes[i]!)

      ctx.fillStyle = this.paletteColor(arcLineColorPalette, colorIdx)
      ctx.fillRect(x - 1, y - 1, 2, 2)
    }
  }

  private drawConnectingLines(
    ctx: CanvasRenderingContext2D,
    region: Canvas2DRegionData,
    block: { bpRangeX: [number, number]; screenStartPx: number },
    bpLength: number,
    fullBlockWidth: number,
    state: RenderState,
  ) {
    if (region.numConnectingLines === 0) {
      return
    }
    const covOffset = state.pileupTopOffset
    const fH = state.featureHeight
    const fSpacing = state.featureSpacing

    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    ctx.lineWidth = 1

    for (let i = 0; i < region.numConnectingLines; i++) {
      const startBp =
        region.connectingLinePositions[i * 2]! + region.regionStart
      const endBp =
        region.connectingLinePositions[i * 2 + 1]! + region.regionStart
      const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
      const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
      const yRow = region.connectingLineYs[i]!
      const y = yRow * (fH + fSpacing) + covOffset - state.rangeY[0] + fH / 2

      ctx.beginPath()
      ctx.moveTo(x1, y)
      ctx.lineTo(x2, y)
      ctx.stroke()
    }
  }

  private drawHighlightOverlays(
    ctx: CanvasRenderingContext2D,
    region: Canvas2DRegionData,
    block: {
      bpRangeX: [number, number]
      screenStartPx: number
      screenEndPx: number
    },
    state: RenderState,
  ) {
    const covOffset = state.pileupTopOffset
    const fH = state.featureHeight
    const fSpacing = state.featureSpacing
    const bpLength = block.bpRangeX[1] - block.bpRangeX[0]
    const fullBlockWidth = block.screenEndPx - block.screenStartPx

    if (state.highlightedChainIds.length === 0 && state.highlightedFeatureId) {
      const idx = region.readIdToIndex.get(state.highlightedFeatureId)
      if (idx !== undefined && idx < region.numReads) {
        const startBp = region.readPositions[idx * 2]! + region.regionStart
        const endBp = region.readPositions[idx * 2 + 1]! + region.regionStart
        const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
        const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
        const y =
          region.readYs[idx]! * (fH + fSpacing) + covOffset - state.rangeY[0]
        ctx.fillStyle = 'rgba(0,0,0,0.15)'
        ctx.fillRect(x1, y, x2 - x1, fH)
      }
    }

    if (state.selectedChainIds.length === 0 && state.selectedFeatureId) {
      const idx = region.readIdToIndex.get(state.selectedFeatureId)
      if (idx !== undefined && idx < region.numReads) {
        const startBp = region.readPositions[idx * 2]! + region.regionStart
        const endBp = region.readPositions[idx * 2 + 1]! + region.regionStart
        const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
        const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
        const y =
          region.readYs[idx]! * (fH + fSpacing) + covOffset - state.rangeY[0]
        ctx.strokeStyle = '#00b8ff'
        ctx.lineWidth = 2
        ctx.strokeRect(x1, y, x2 - x1, fH)
      }
    }
  }

  private drawChainOverlays(
    ctx: CanvasRenderingContext2D,
    region: Canvas2DRegionData,
    block: {
      bpRangeX: [number, number]
      screenStartPx: number
      screenEndPx: number
    },
    state: RenderState,
  ) {
    const covOffset = state.pileupTopOffset
    const fH = state.featureHeight
    const fSpacing = state.featureSpacing
    const bpLength = block.bpRangeX[1] - block.bpRangeX[0]
    const fullBlockWidth = block.screenEndPx - block.screenStartPx

    if (state.highlightedChainIds.length > 0) {
      const bounds = getChainBounds(
        state.highlightedChainIds,
        region.readIdToIndex,
        region.readPositions,
        region.readYs,
      )
      if (bounds) {
        const startBp = bounds.minStart + region.regionStart
        const endBp = bounds.maxEnd + region.regionStart
        const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
        const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
        const y = bounds.y * (fH + fSpacing) + covOffset - state.rangeY[0]
        ctx.fillStyle = 'rgba(0,0,0,0.4)'
        ctx.fillRect(x1, y, x2 - x1, fH)
      }
    }

    if (state.selectedChainIds.length > 0) {
      const bounds = getChainBounds(
        state.selectedChainIds,
        region.readIdToIndex,
        region.readPositions,
        region.readYs,
      )
      if (bounds) {
        const startBp = bounds.minStart + region.regionStart
        const endBp = bounds.maxEnd + region.regionStart
        const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
        const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
        const y = bounds.y * (fH + fSpacing) + covOffset - state.rangeY[0]
        ctx.strokeStyle = '#00b8ff'
        ctx.lineWidth = 2
        ctx.strokeRect(x1, y, x2 - x1, fH)
      }
    }
  }

  dispose() {
    this.regions.clear()
  }
}
