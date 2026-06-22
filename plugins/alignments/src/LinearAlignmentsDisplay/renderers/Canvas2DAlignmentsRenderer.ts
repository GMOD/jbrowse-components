import {
  clipBlockForCanvas,
  prepareCanvas,
} from '@jbrowse/render-core/canvas2dUtils'

import { PILEUP_LAYERS } from './pileupLayers.ts'
import {
  type AlignmentsRenderingBackend,
  type AlignmentsSources,
  type CigarUploadData,
  type DrawBlock,
  type RenderBlock,
  type RenderState,
  bpToScreenX,
  interbaseRangeEnds,
  pileupRowY,
  sectionRegionKey,
  sectionRenderState,
} from './rendererTypes.ts'
import { drawArcs } from '../../features/arcs/drawCanvas.ts'
import { emptyArcsUploadData } from '../../features/arcs/types.ts'
import { drawConnectingLines } from '../../features/connectingLines/drawCanvas.ts'
import { emptyConnectingLinesUploadData } from '../../features/connectingLines/types.ts'
import {
  buildCoverageFields,
  emptyCoverageFields,
} from '../../features/coverage/buildRegion.ts'
import { drawCoverageBars } from '../../features/coverage/drawCanvas.ts'
import { drawGaps } from '../../features/gap/drawCanvas.ts'
import { drawIndicatorCanvas } from '../../features/indicator/drawCanvas.ts'
import { drawInsertions } from '../../features/insertion/drawCanvas.ts'
import { drawInterbaseCanvas } from '../../features/interbase/drawCanvas.ts'
import { drawLinkedReadLines } from '../../features/linkedReads/drawCanvas.ts'
import { emptyLinkedReadLinesUploadData } from '../../features/linkedReads/types.ts'
import { drawMismatches } from '../../features/mismatch/drawCanvas.ts'
import { drawModCoverageCanvas } from '../../features/modCoverage/drawCanvas.ts'
import { drawModifications } from '../../features/modification/drawCanvas.ts'
import { drawOverlaps } from '../../features/overlap/drawCanvas.ts'
import { emptyOverlapsUploadData } from '../../features/overlap/types.ts'
import { drawPerBaseLetter } from '../../features/perBaseLetter/drawCanvas.ts'
import { drawPerBaseQuality } from '../../features/perBaseQuality/drawCanvas.ts'
import {
  buildReadFields,
  emptyReadFields,
} from '../../features/read/buildRegion.ts'
import { drawReads } from '../../features/read/drawCanvas.ts'
import { drawSnpSegmentsCanvas } from '../../features/snpCoverage/drawCanvas.ts'
import { drawSoftclipBases } from '../../features/softclip/drawBases.ts'
import { drawHardclips, drawSoftclips } from '../../shared/drawClipBars.ts'
import { getChainBounds } from '../components/chainOverlayUtils.ts'

import type { PileupLayerId } from './pileupLayers.ts'
import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { ArcsUploadData } from '../../features/arcs/types.ts'
import type { ConnectingLinesUploadData } from '../../features/connectingLines/types.ts'
import type { CoverageRegionFields } from '../../features/coverage/buildRegion.ts'
import type { GapUploadData } from '../../features/gap/types.ts'
import type { LinkedReadLinesUploadData } from '../../features/linkedReads/types.ts'
import type { MismatchUploadData } from '../../features/mismatch/types.ts'
import type { ModificationUploadData } from '../../features/modification/types.ts'
import type { OverlapsUploadData } from '../../features/overlap/types.ts'
import type { PerBaseLetterUploadData } from '../../features/perBaseLetter/types.ts'
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
    OverlapsUploadData,
    PerBaseQualityUploadData,
    PerBaseLetterUploadData {
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
  interbasePackedBuffer: ArrayBuffer
  interbaseMaxCount: number
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

const EMPTY_PILEUP_FIELDS: Canvas2DRegionData = {
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
  perBaseLetterPositions: new Uint32Array(0),
  perBaseLetterYs: new Uint16Array(0),
  perBaseLetterBases: new Uint8Array(0),
  ...emptyCoverageFields(),
  snpPackedBuffer: new ArrayBuffer(0),
  modCovPackedBuffer: new ArrayBuffer(0),
  interbasePackedBuffer: new ArrayBuffer(0),
  interbaseMaxCount: 0,
  indicatorPackedBuffer: new ArrayBuffer(0),
  ...emptyArcsUploadData(),
  ...emptyConnectingLinesUploadData(),
  ...emptyLinkedReadLinesUploadData(),
  ...emptyOverlapsUploadData(),
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
    perBaseLetterPositions: data.perBaseLetterPositions,
    perBaseLetterYs: data.perBaseLetterYs,
    perBaseLetterBases: data.perBaseLetterBases,
    ...buildCoverageFields(data),
    snpPackedBuffer: data.snpPackedBuffer,
    modCovPackedBuffer: data.modCovPackedBuffer,
    interbasePackedBuffer: data.interbasePackedBuffer,
    interbaseMaxCount: data.interbaseMaxCount,
    indicatorPackedBuffer: data.indicatorPackedBuffer,
    connectingLinePositions: data.connectingLinePositions,
    connectingLineYs: data.connectingLineYs,
    linkedReadLinePositions: data.linkedReadLinePositions,
    linkedReadLineYs: data.linkedReadLineYs,
    linkedReadLineColorTypes: data.linkedReadLineColorTypes,
    numLinkedReadLines: data.numLinkedReadLines,
    overlapPositions: data.overlapPositions,
    overlapYs: data.overlapYs,
    ...(arcs ?? emptyArcsUploadData()),
  }
}

/**
 * Pure builder: turns the model's observable per-section inputs into the
 * regions map that `drawAlignmentBlocks` consumes, keyed by `sectionRegionKey`
 * so stacked groups don't collide. The on-screen Canvas2DAlignmentsRenderer.sync
 * calls this directly, so on-screen and SVG export share one builder. Section 0
 * keys equal the raw region index, so ungrouped is byte-identical.
 */
export function buildAlignmentsRegionMap(sources: AlignmentsSources) {
  const regions = new Map<number, Canvas2DRegionData>()
  sources.sections.forEach((section, s) => {
    for (const [regionIdx, data] of section.laidOutPileupMap) {
      regions.set(
        sectionRegionKey(s, regionIdx),
        buildPileupRegion(data, section.arcsRpcDataMap.get(regionIdx)),
      )
    }
    // Arc-only regions (arcs arrived for a region with no pileup) attach to
    // this same section.
    for (const [regionIdx, arcs] of section.arcsRpcDataMap) {
      if (!section.laidOutPileupMap.has(regionIdx)) {
        regions.set(sectionRegionKey(s, regionIdx), {
          ...EMPTY_PILEUP_FIELDS,
          ...arcs,
        })
      }
    }
  })
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
    buildAlignmentsRegionMap(sources),
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
export class Canvas2DAlignmentsRenderer implements AlignmentsRenderingBackend {
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
    this.regions = buildAlignmentsRegionMap(sources)
  }

  renderBlocks(blocks: RenderBlock[], state: RenderState) {
    prepareCanvas(this.canvas, this.ctx, state.canvasWidth, state.canvasHeight)
    return drawAlignmentBlocks(this.ctx, this.regions, blocks, state)
  }

  dispose() {
    this.regions = new Map()
  }
}

type PileupDrawFn = (
  ctx: Ctx2D,
  region: Canvas2DRegionData,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) => void

// Each pileup layer's Canvas2D draw function. The z-order and gating live in the
// shared `PILEUP_LAYERS` list (also driving the GPU renderer); this map resolves
// each layer to its draw call. Typed `Record<PileupLayerId, …>` so a layer can't
// be added to the shared list without wiring its draw here. The GPU `clip` pass
// covers both soft- and hard-clip bars, so the canvas `clip` entry draws both.
const CANVAS_PILEUP_DRAW: Record<PileupLayerId, PileupDrawFn> = {
  connLine: drawConnectingLines,
  linkedReadLine: drawLinkedReadLines,
  read: drawReads,
  overlap: drawOverlaps,
  mod: drawModifications,
  perBaseQual: drawPerBaseQuality,
  gap: drawGaps,
  mismatch: drawMismatches,
  insertion: drawInsertions,
  clip: (ctx, region, block, bpLength, fullBlockWidth, state) => {
    drawSoftclips(ctx, region, block, bpLength, fullBlockWidth, state)
    drawHardclips(ctx, region, block, bpLength, fullBlockWidth, state)
  },
  softclipBases: drawSoftclipBases,
  perBaseLetter: drawPerBaseLetter,
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

  for (const block of blocks) {
    const blockClip = clipBlockForCanvas(block, canvasWidth)
    if (!blockClip) {
      continue
    }

    const { fullBlockWidth, bpLength, scissorX, scissorW } = blockClip

    ctx.save()
    ctx.beginPath()
    ctx.rect(scissorX, 0, scissorW, canvasHeight)
    ctx.clip()

    // Each stacked section sets its own vertical offsets and clip bands.
    // Section 0's region key equals the raw region index, so the ungrouped
    // (single-section) path reproduces the prior draw exactly.
    for (let s = 0; s < state.sections.length; s++) {
      const sec = state.sections[s]!
      const region = regions.get(
        sectionRegionKey(s, block.displayedRegionIndex),
      )
      if (!region) {
        continue
      }
      const sectionState = sectionRenderState(state, sec)

      if (state.showCoverage) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(scissorX, sec.covClipTop, scissorW, sec.covClipHeight)
        ctx.clip()
        drawCoverage(ctx, region, block, bpLength, fullBlockWidth, sectionState)
        ctx.restore()
      }

      // Clip pileup area
      ctx.save()
      ctx.beginPath()
      ctx.rect(scissorX, sec.pileupClipTop, scissorW, sec.pileupClipHeight)
      ctx.clip()

      // Pileup layers in z-order, gated and ordered by the shared PILEUP_LAYERS
      // list (the GPU renderer iterates the same list). Gating reads the
      // display-wide `state`; the draw fns take the per-section `sectionState`.
      for (const layer of PILEUP_LAYERS) {
        if (layer.enabled(state)) {
          CANVAS_PILEUP_DRAW[layer.id](
            ctx,
            region,
            block,
            bpLength,
            fullBlockWidth,
            sectionState,
          )
        }
      }

      drawSelectionOverlays(ctx, region, block, sectionState)

      ctx.restore() // pileup clip

      // Up- and down-mode arcs both draw here, after the pileup. The band never
      // overlaps the pileup region, and up-mode arcs still land in front of the
      // coverage histogram (drawn earlier), matching the GPU pass order. Each
      // section carries its own (scrolled) band; undefined when arcs are off.
      const arcBand = sec.arcBand
      if (arcBand) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(scissorX, arcBand.top, scissorW, arcBand.height)
        ctx.clip()
        drawArcs(
          ctx,
          region,
          block,
          bpLength,
          fullBlockWidth,
          sectionState,
          arcBand.top,
          arcBand.height,
          arcBand.down,
          scissorW,
        )
        ctx.restore()
      }
    }

    ctx.restore() // block clip
  }
  return true
}

function drawCoverage(
  ctx: Ctx2D,
  region: Canvas2DRegionData,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  const bpToX = (bp: number) => bpToScreenX(bp, block, bpLength, fullBlockWidth)
  const viewWidth = fullBlockWidth + block.screenStartPx
  // Depth-scaled layers need the autoscaled domain max; until coverage stats
  // are computed (coarseDynamicBlocks is 500ms-debounced) it's undefined and
  // these are skipped. Interbase clip/insertion bars are *positioned* at the
  // band top but their *height* tracks the depth domain (like the coverage and
  // SNP bars), so they belong inside this block. The fixed-size indicator
  // triangles are the only band-top marks independent of the depth scale.
  // The coverage draw helpers anchor bars/segments/indicators at the canvas
  // top (clip-top). Shifting the whole band by coverageTopOffset lets grouped
  // sections scroll their coverage with the section; it is 0 (no-op) for the
  // ungrouped sticky-coverage path, mirroring the shader `covTop` uniform.
  ctx.save()
  ctx.translate(0, state.coverageTopOffset)
  const domainMax = state.coverageMaxDepth
  if (domainMax !== undefined) {
    drawCoverageBars(ctx, region, bpToX, viewWidth, state, domainMax)
    drawSnpSegmentsCanvas(ctx, region, bpToX, viewWidth, state, domainMax)
    drawModCoverageCanvas(ctx, region, bpToX, viewWidth, state, domainMax)
    drawInterbaseCanvas(ctx, region, bpToX, viewWidth, state, domainMax)
  }
  if (state.showInterbaseIndicators) {
    drawIndicatorCanvas(ctx, region, bpToX, viewWidth, state)
  }
  ctx.restore()
}

interface OverlayBounds {
  startBp: number
  endBp: number
  yRow: number
}

interface OverlayBlock {
  start: number
  end: number
  screenStartPx: number
  screenEndPx: number
  reversed?: boolean
}

function paintSelectionBox(
  ctx: Ctx2D,
  bounds: OverlayBounds,
  block: OverlayBlock,
  state: RenderState,
) {
  const bpLength = block.end - block.start
  const fullBlockWidth = block.screenEndPx - block.screenStartPx
  const x1 = bpToScreenX(bounds.startBp, block, bpLength, fullBlockWidth)
  const x2 = bpToScreenX(bounds.endBp, block, bpLength, fullBlockWidth)
  const y = pileupRowY(bounds.yRow, state)
  ctx.strokeStyle = '#00b8ff'
  ctx.lineWidth = 2
  ctx.strokeRect(x1, y, x2 - x1, state.featureHeight)
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

// Selection only — the hover highlight is a React overlay (HighlightOverlay).
function drawSelectionOverlays(
  ctx: Ctx2D,
  region: Canvas2DRegionData,
  block: OverlayBlock,
  state: RenderState,
) {
  if (state.selectedChainIds.length === 0 && state.selectedFeatureId) {
    const bounds = readBoundsForId(region, state.selectedFeatureId)
    if (bounds) {
      paintSelectionBox(ctx, bounds, block, state)
    }
  }
  if (state.selectedChainIds.length > 0) {
    const bounds = getChainBounds(state.selectedChainIds, region)
    if (bounds) {
      paintSelectionBox(ctx, bounds, block, state)
    }
  }
}
