import {
  clipBlockForCanvas,
  prepareCanvas,
} from '@jbrowse/core/gpu/canvas2dUtils'

import { getChainBounds } from './chainOverlayUtils.ts'
import {
  bpToScreenX,
  computeBlockHeights,
  interbaseRangeEnds,
  pileupRowY,
} from './rendererTypes.ts'
import { drawArcs } from '../../features/arcs/drawCanvas.ts'
import { emptyArcsUploadData } from '../../features/arcs/types.ts'
import { drawConnectingLines } from '../../features/connectingLines/drawCanvas.ts'
import {
  buildCoverageFields,
  emptyCoverageFields,
} from '../../features/coverage/buildRegion.ts'
import { drawCoverageBars } from '../../features/coverage/drawCanvas.ts'
import { drawGaps } from '../../features/gap/drawCanvas.ts'
import { drawIndicatorCanvas } from '../../features/indicator/drawCanvas.ts'
import { drawInsertions } from '../../features/insertion/drawCanvas.ts'
import { drawLinkedReadLines } from '../../features/linkedReads/drawCanvas.ts'
import { drawMismatches } from '../../features/mismatch/drawCanvas.ts'
import { drawModCoverageCanvas } from '../../features/modCoverage/drawCanvas.ts'
import { drawModifications } from '../../features/modification/drawCanvas.ts'
import { drawNoncovCanvas } from '../../features/noncov/drawCanvas.ts'
import { drawPerBaseQuality } from '../../features/perBaseQuality/drawCanvas.ts'
import {
  buildReadFields,
  emptyReadFields,
} from '../../features/read/buildRegion.ts'
import { drawReads } from '../../features/read/drawCanvas.ts'
import { drawSnpSegmentsCanvas } from '../../features/snpCoverage/drawCanvas.ts'
import { drawSoftclipBases } from '../../features/softclip/drawBases.ts'
import { drawHardclips, drawSoftclips } from '../../shared/drawClipBars.ts'

import type {
  AlignmentsBackend,
  AlignmentsSources,
  CigarUploadData,
  RenderBlock,
  RenderState,
} from './rendererTypes.ts'
import type { PileupDataResult } from '../../RenderPileupDataRPC/types.ts'
import type { ArcsUploadData } from '../../features/arcs/types.ts'
import type { ConnectingLinesUploadData } from '../../features/connectingLines/types.ts'
import type { CoverageRegionFields } from '../../features/coverage/buildRegion.ts'
import type { GapUploadData } from '../../features/gap/types.ts'
import type { LinkedReadLinesUploadData } from '../../features/linkedReads/types.ts'
import type { MismatchUploadData } from '../../features/mismatch/types.ts'
import type { ModificationUploadData } from '../../features/modification/types.ts'
import type { PerBaseQualityUploadData } from '../../features/perBaseQuality/types.ts'
import type { ReadRegionFields } from '../../features/read/buildRegion.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export interface Canvas2DRegionData
  extends
    ReadRegionFields,
    ArcsUploadData,
    ConnectingLinesUploadData,
    CoverageRegionFields,
    GapUploadData,
    LinkedReadLinesUploadData,
    MismatchUploadData,
    ModificationUploadData,
    PerBaseQualityUploadData {
  // interbase arrays sliced from merged worker buffer
  insertionPositions: Uint32Array
  insertionYs: Uint16Array
  insertionLengths: Uint16Array
  insertionFrequencies: Uint8Array
  softclipPositions: Uint32Array
  softclipYs: Uint16Array
  hardclipPositions: Uint32Array
  hardclipYs: Uint16Array
  softclipBasePositions: Uint32Array
  softclipBaseYs: Uint16Array
  softclipBaseBases: Uint8Array
  snpPackedBuffer: ArrayBuffer
  modCovPackedBuffer: ArrayBuffer
  noncovPackedBuffer: ArrayBuffer
  noncovMaxCount: number
  indicatorPackedBuffer: ArrayBuffer
}

// Builds all CIGAR-derived canvas fields. The merged interbase array is
// partitioned as [insertions | softclips | hardclips] by the worker.
function buildCigarFields(data: CigarUploadData) {
  const { insEnd, scEnd, hcEnd } = interbaseRangeEnds(data)
  return {
    // gap positions store [start, end] pairs
    gapPositions: data.gapPositions,
    gapYs: data.gapYs,
    gapTypes: data.gapTypes,
    gapFrequencies: data.gapFrequencies,
    mismatchPositions: data.mismatchPositions,
    mismatchYs: data.mismatchYs,
    mismatchBases: data.mismatchBases,
    mismatchFrequencies: data.mismatchFrequencies,
    insertionPositions: data.interbasePositions.subarray(0, insEnd),
    insertionYs: data.interbaseYs.subarray(0, insEnd),
    insertionLengths: data.interbaseLengths.subarray(0, insEnd),
    insertionFrequencies: data.interbaseFrequencies.subarray(0, insEnd),
    softclipPositions: data.interbasePositions.subarray(insEnd, scEnd),
    softclipYs: data.interbaseYs.subarray(insEnd, scEnd),
    hardclipPositions: data.interbasePositions.subarray(scEnd, hcEnd),
    hardclipYs: data.interbaseYs.subarray(scEnd, hcEnd),
    softclipBasePositions: data.softclipBasePositions,
    softclipBaseYs: data.softclipBaseYs,
    softclipBaseBases: data.softclipBaseBases,
  }
}

function emptyPileupFields(): Canvas2DRegionData {
  return {
    ...emptyReadFields(),
    gapPositions: new Uint32Array(0),
    gapYs: new Uint16Array(0),
    gapTypes: new Uint8Array(0),
    gapFrequencies: new Uint8Array(0),
    mismatchPositions: new Uint32Array(0),
    mismatchYs: new Uint16Array(0),
    mismatchBases: new Uint8Array(0),
    mismatchFrequencies: new Uint8Array(0),
    insertionPositions: new Uint32Array(0),
    insertionYs: new Uint16Array(0),
    insertionLengths: new Uint16Array(0),
    insertionFrequencies: new Uint8Array(0),
    softclipPositions: new Uint32Array(0),
    softclipYs: new Uint16Array(0),
    hardclipPositions: new Uint32Array(0),
    hardclipYs: new Uint16Array(0),
    softclipBasePositions: new Uint32Array(0),
    softclipBaseYs: new Uint16Array(0),
    softclipBaseBases: new Uint8Array(0),
    modificationPositions: new Uint32Array(0),
    modificationYs: new Uint16Array(0),
    modificationColors: new Uint32Array(0),
    perBaseQualPositions: new Uint32Array(0),
    perBaseQualYs: new Uint16Array(0),
    perBaseQualScores: new Uint8Array(0),
    ...emptyCoverageFields(),
    snpPackedBuffer: new ArrayBuffer(0),
    modCovPackedBuffer: new ArrayBuffer(0),
    noncovPackedBuffer: new ArrayBuffer(0),
    noncovMaxCount: 0,
    indicatorPackedBuffer: new ArrayBuffer(0),
    ...emptyArcsUploadData(),
    connectingLinePositions: new Uint32Array(0),
    connectingLineYs: new Uint16Array(0),
    linkedReadLinePositions: new Uint32Array(0),
    linkedReadLineYs: new Uint16Array(0),
    linkedReadLineColorTypes: new Uint8Array(0),
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
    modificationPositions: data.modificationPositions,
    modificationYs: data.modificationYs,
    modificationColors: data.modificationColors,
    perBaseQualPositions: data.perBaseQualPositions,
    perBaseQualYs: data.perBaseQualYs,
    perBaseQualScores: data.perBaseQualScores,
    ...buildCoverageFields(data),
    snpPackedBuffer: data.snpPackedBuffer,
    modCovPackedBuffer: data.modCovPackedBuffer,
    noncovPackedBuffer: data.noncovPackedBuffer,
    noncovMaxCount: data.noncovMaxCount,
    indicatorPackedBuffer: data.indicatorPackedBuffer,
    connectingLinePositions: data.connectingLinePositions,
    connectingLineYs: data.connectingLineYs,
    linkedReadLinePositions: data.linkedReadLinePositions,
    linkedReadLineYs: data.linkedReadLineYs,
    linkedReadLineColorTypes: data.linkedReadLineColorTypes,
    numLinkedReadLines: data.numLinkedReadLines,
    ...(arcs ?? emptyArcsUploadData()),
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
      regions.set(idx, { ...emptyPileupFields(), ...arcs })
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

    const domainMax = state.coverageMaxDepth
    if (state.showCoverage && domainMax) {
      drawCoverage(
        ctx,
        region,
        block,
        bpLength,
        fullBlockWidth,
        state,
        domainMax,
      )
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

    drawSoftclips(ctx, region, block, bpLength, fullBlockWidth, state)
    drawHardclips(ctx, region, block, bpLength, fullBlockWidth, state)

    if (state.showSoftClipping) {
      drawSoftclipBases(ctx, region, block, bpLength, fullBlockWidth, state)
    }

    if (state.showModifications) {
      drawModifications(ctx, region, block, bpLength, fullBlockWidth, state)
    }

    if (state.showPerBaseQuality) {
      drawPerBaseQuality(ctx, region, block, bpLength, fullBlockWidth, state)
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

function drawCoverage(
  ctx: Ctx2D,
  region: Canvas2DRegionData,
  block: { bpRangeX: [number, number]; screenStartPx: number },
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
  domainMax: number,
) {
  const bpToX = (bp: number) => bpToScreenX(bp, block, bpLength, fullBlockWidth)
  const viewWidth = fullBlockWidth + block.screenStartPx
  drawCoverageBars(ctx, region, bpToX, viewWidth, state, domainMax)
  drawSnpSegmentsCanvas(ctx, region, bpToX, viewWidth, state, domainMax)
  drawModCoverageCanvas(ctx, region, bpToX, viewWidth, state, domainMax)
  drawNoncovCanvas(ctx, region, bpToX, viewWidth, state)
  drawIndicatorCanvas(ctx, region, bpToX, viewWidth, state)
}

interface OverlayBounds {
  startBp: number
  endBp: number
  yRow: number
}

interface OverlayBlock {
  bpRangeX: [number, number]
  screenStartPx: number
  screenEndPx: number
}

function paintOverlayBox(
  ctx: Ctx2D,
  bounds: OverlayBounds,
  block: OverlayBlock,
  state: RenderState,
  style: 'highlight' | 'selection' | 'chainHighlight',
) {
  const bpLength = block.bpRangeX[1] - block.bpRangeX[0]
  const fullBlockWidth = block.screenEndPx - block.screenStartPx
  const x1 = bpToScreenX(bounds.startBp, block, bpLength, fullBlockWidth)
  const x2 = bpToScreenX(bounds.endBp, block, bpLength, fullBlockWidth)
  const y = pileupRowY(bounds.yRow, state)
  const w = x2 - x1
  const h = state.featureHeight
  if (style === 'selection') {
    ctx.strokeStyle = '#00b8ff'
    ctx.lineWidth = 2
    ctx.strokeRect(x1, y, w, h)
  } else {
    ctx.fillStyle =
      style === 'chainHighlight' ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.15)'
    ctx.fillRect(x1, y, w, h)
  }
}

function readBoundsForId(
  region: Canvas2DRegionData,
  id: string,
): OverlayBounds | undefined {
  const idx = region.readIdToIndex.get(id)
  if (idx === undefined || idx >= region.readFlags.length) {
    return undefined
  }
  return {
    startBp: region.readPositions[idx * 2]!,
    endBp: region.readPositions[idx * 2 + 1]!,
    yRow: region.readYs[idx]!,
  }
}

function chainBoundsFor(
  region: Canvas2DRegionData,
  ids: string[],
): OverlayBounds | undefined {
  const b = getChainBounds(ids, region)
  if (!b) {
    return undefined
  }
  return { startBp: b.minStart, endBp: b.maxEnd, yRow: b.y }
}

function drawHighlightOverlays(
  ctx: Ctx2D,
  region: Canvas2DRegionData,
  block: OverlayBlock,
  state: RenderState,
) {
  if (state.highlightedChainIds.length === 0 && state.highlightedFeatureId) {
    const bounds = readBoundsForId(region, state.highlightedFeatureId)
    if (bounds) {
      paintOverlayBox(ctx, bounds, block, state, 'highlight')
    }
  }
  if (state.selectedChainIds.length === 0 && state.selectedFeatureId) {
    const bounds = readBoundsForId(region, state.selectedFeatureId)
    if (bounds) {
      paintOverlayBox(ctx, bounds, block, state, 'selection')
    }
  }
}

function drawChainOverlays(
  ctx: Ctx2D,
  region: Canvas2DRegionData,
  block: OverlayBlock,
  state: RenderState,
) {
  if (state.highlightedChainIds.length > 0) {
    const bounds = chainBoundsFor(region, state.highlightedChainIds)
    if (bounds) {
      paintOverlayBox(ctx, bounds, block, state, 'chainHighlight')
    }
  }
  if (state.selectedChainIds.length > 0) {
    const bounds = chainBoundsFor(region, state.selectedChainIds)
    if (bounds) {
      paintOverlayBox(ctx, bounds, block, state, 'selection')
    }
  }
}
