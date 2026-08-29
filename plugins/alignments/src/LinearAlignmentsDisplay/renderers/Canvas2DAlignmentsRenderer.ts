import {
  forEachClippedBlock,
  prepareCanvas,
  withClip,
} from '@jbrowse/render-core/canvas2dUtils'
import { Canvas2DRenderingBackendBase } from '@jbrowse/render-core/renderingBackendBase'

import { drawArcs } from '../../features/arcs/drawCanvas.ts'
import { emptyArcsUploadData } from '../../features/arcs/types.ts'
import { drawHardclips, drawSoftclips } from '../../features/clip/drawCanvas.ts'
import { drawConnectingLines } from '../../features/connectingLines/drawCanvas.ts'
import { emptyConnectingLinesUploadData } from '../../features/connectingLines/types.ts'
import { makeCoverageScale } from '../../features/coverage/coverageScale.ts'
import { drawCoverageBars } from '../../features/coverage/drawCanvas.ts'
import { drawDeletions, drawSkips } from '../../features/gap/drawCanvas.ts'
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
import { drawSoftclipBases } from '../../features/softclipBases/drawCanvas.ts'
import { getSelectionBounds } from '../components/chainOverlayUtils.ts'
import { COVERAGE_LAYERS } from './coverageLayers.ts'
import { PILEUP_LAYERS } from './pileupLayers.ts'
import {
  bpToScreenX,
  pileupRowY,
  sectionRegionKey,
  sectionRenderState,
} from './rendererTypes.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { ArcsUploadData } from '../../features/arcs/types.ts'
import type { ConnectingLinesUploadData } from '../../features/connectingLines/types.ts'
import type { CoverageScale } from '../../features/coverage/coverageScale.ts'
import type { CoverageRegionFields } from '../../features/coverage/types.ts'
import type { GapUploadData } from '../../features/gap/types.ts'
import type { LinkedReadLinesUploadData } from '../../features/linkedReads/types.ts'
import type { MismatchUploadData } from '../../features/mismatch/types.ts'
import type { ModificationUploadData } from '../../features/modification/types.ts'
import type { OverlapsUploadData } from '../../features/overlap/types.ts'
import type { PerBaseLetterUploadData } from '../../features/perBaseLetter/types.ts'
import type { PerBaseQualityUploadData } from '../../features/perBaseQuality/types.ts'
import type { ReadRegionFields } from '../../features/read/buildRegion.ts'
import type { InterbaseUploadData } from '../../shared/uploadTypes.ts'
import type { CoverageLayer } from './coverageLayers.ts'
import type { PileupLayerId } from './pileupLayers.ts'
import type {
  AlignmentsRenderingBackend,
  AlignmentsSources,
  CigarUploadData,
  DrawBlock,
  RenderBlock,
  RenderState,
  SectionRender,
} from './rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { CoverageLayerId } from '@jbrowse/render-core/coverageBand'

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
    InterbaseUploadData,
    PerBaseLetterUploadData {
  softclipBasePositions: Uint32Array
  softclipBaseYs: Uint16Array
  softclipBaseBases: Uint8Array
  snpPackedBuffer: ArrayBuffer
  modCovPackedBuffer: ArrayBuffer
  interbasePackedBuffer: ArrayBuffer
  interbaseMaxCount: number
  indicatorPackedBuffer: ArrayBuffer
}

// Builds all CIGAR-derived canvas fields. The merged interbase array travels
// whole, with the three counts that partition it as
// [insertions | softclips | hardclips]: the insertion and clip painters read it
// through their marks, which declare their own slice of it, so the packer, the
// painter and the hit test now bound their walks by one expression rather than
// three. The nine pre-sliced views this used to hand the painters were that
// third expression.
function buildCigarFields(data: CigarUploadData) {
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
    mismatchQuals: data.mismatchQuals,
    interbasePositions: data.interbasePositions,
    interbaseYs: data.interbaseYs,
    interbaseLengths: data.interbaseLengths,
    interbaseFrequencies: data.interbaseFrequencies,
    numInsertions: data.numInsertions,
    numSoftclips: data.numSoftclips,
    numHardclips: data.numHardclips,
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
  mismatchQuals: new Uint8Array(0),
  interbasePositions: new Uint32Array(0),
  interbaseYs: new Uint16Array(0),
  interbaseLengths: new Uint32Array(0),
  interbaseFrequencies: new Uint8Array(0),
  numInsertions: 0,
  numSoftclips: 0,
  numHardclips: 0,
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
  coveragePackedBuffer: new ArrayBuffer(0),
  coverageMaxDepth: 0,
  coverageBinSize: 1,
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
    coveragePackedBuffer: data.coveragePackedBuffer,
    coverageMaxDepth: data.coverageMaxDepth,
    coverageBinSize: data.coverageBinSize,
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
export class Canvas2DAlignmentsRenderer
  extends Canvas2DRenderingBackendBase
  implements AlignmentsRenderingBackend
{
  private regions: ReadonlyMap<number, Canvas2DRegionData> = new Map()

  constructor(canvas: HTMLCanvasElement) {
    super(canvas)
  }

  release() {}

  upload(_key: 'sources', sources: AlignmentsSources) {
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
  skip: drawSkips,
  deletion: drawDeletions,
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

  // Whether any block had a section with data to paint from, mirroring the
  // GPU's `drawSection` contract so both backends flip `canvasDrawn` on the same
  // states (see the parity cases in coverageParity.test.ts). The band heights
  // deliberately do not enter into it: a section whose fetch landed paints the
  // frame it should paint, blank included, and `drawSection` carries why.
  let painted = false

  // Which layers draw this frame, resolved once. The gates read the
  // display-wide `state` (the show flags are the same in every section), so
  // asking them per section per block re-answered one question up to 120 times
  // a frame at MAX_GROUPS.
  const layers = PILEUP_LAYERS.filter(l => l.enabled(state))
  // The coverage band's three per-frame answers, hoisted for the same reason
  // and out of the same loop. Every `COVERAGE_LAYERS` gate reads display-wide
  // state, the depth scale is built from the three domain fields
  // `sectionRenderState` does not override, and a section state differs from
  // the display's only in two Y offsets — so all three were re-derived per
  // block per section to produce the same value.
  const coverageLayers = COVERAGE_LAYERS.filter(l => l.enabled(state))
  const coverageScale = makeCoverageScale(state)
  const sectionStates = state.sections.map(sec =>
    sectionRenderState(state, sec),
  )

  forEachClippedBlock(
    ctx,
    blocks,
    canvasWidth,
    canvasHeight,
    // The block's drawable sections, or `undefined` to skip the block whole.
    // A section with no region in the map paints nothing and reports nothing,
    // so resolving them here rather than `continue`-ing inside the paint body
    // also gives the gate something real to answer: a block no section has
    // data for now costs neither the clip nor the SvgCanvas group.
    block => {
      const found = state.sections
        .map((sec, s) => ({
          sec,
          sectionState: sectionStates[s]!,
          region: regions.get(sectionRegionKey(s, block.displayedRegionIndex)),
        }))
        .filter(
          (
            e,
          ): e is {
            sec: SectionRender
            sectionState: RenderState
            region: Canvas2DRegionData
          } => Boolean(e.region),
        )
      return found.length > 0 ? found : undefined
    },
    (sections, block, { fullBlockWidth, bpLength, scissorX, scissorW }) => {
      // Every block reaching here has a section with a region, which is the
      // GPU's test too.
      painted = true

      // Each stacked section sets its own vertical offsets and clip bands.
      // Section 0's region key equals the raw region index, so the ungrouped
      // (single-section) path reproduces the prior draw exactly.
      for (const { sec, sectionState, region } of sections) {
        if (state.coverageHeight > 0) {
          withClip(
            ctx,
            scissorX,
            sec.covClipTop,
            scissorW,
            sec.covClipHeight,
            () => {
              drawCoverage(
                ctx,
                region,
                block,
                bpLength,
                fullBlockWidth,
                sectionState,
                coverageLayers,
                coverageScale,
              )
            },
          )
        }

        withClip(
          ctx,
          scissorX,
          sec.pileupClipTop,
          scissorW,
          sec.pileupClipHeight,
          () => {
            // Pileup layers in z-order, ordered by the shared PILEUP_LAYERS list
            // (the GPU renderer iterates the same list) and gated above. The
            // draw fns take the per-section `sectionState`.
            for (const layer of layers) {
              CANVAS_PILEUP_DRAW[layer.id](
                ctx,
                region,
                block,
                bpLength,
                fullBlockWidth,
                sectionState,
              )
            }
            drawSelectionOverlays(ctx, region, block, sectionState)
          },
        )

        // Up- and down-mode arcs both draw here, after the pileup. The band
        // never overlaps the pileup region, and up-mode arcs still land in front
        // of the coverage histogram (drawn earlier), matching the GPU pass
        // order. Each section carries its own (scrolled) band; undefined when
        // arcs are off.
        const arcBand = sec.arcBand
        if (arcBand) {
          withClip(ctx, scissorX, arcBand.top, scissorW, arcBand.height, () => {
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
          })
        }
      }
    },
  )
  return painted
}

type CoverageDrawFn = (
  ctx: Ctx2D,
  region: Canvas2DRegionData,
  bpToX: (bp: number) => number,
  viewWidth: number,
  state: RenderState,
  scale: CoverageScale | undefined,
) => void

// Each coverage-band layer's Canvas2D draw. The z-order and gating live in the
// shared `COVERAGE_LAYERS` list (the GPU renderer iterates the same one); this
// map resolves each id to its call, and being a `Record<CoverageLayerId, …>` is
// what makes a layer added to that list a compile error here.
//
// The sixth argument is the whole `CoverageScale` rather than the piece each
// layer wants, because the pieces differ — the depth-scaled layers read
// `normalize`, the interbase bars read `domainMax` (their height is a ratio of
// event counts against a half-band reference, so the domain MIN has nothing to
// say about them), and the indicator triangles are fixed-size and read neither.
//
// The `if (scale)` in the first four is a narrowing, not a second gate: their
// entry in `COVERAGE_LAYERS` is `hasCoverageScale`, which is the same question
// `makeCoverageScale` answers by returning `undefined`, and TypeScript cannot
// see that the list already asked it.
export const CANVAS_COVERAGE_DRAW: Record<CoverageLayerId, CoverageDrawFn> = {
  coverage: (ctx, region, bpToX, viewWidth, state, scale) => {
    if (scale) {
      drawCoverageBars(ctx, region, bpToX, viewWidth, state, scale.normalize)
    }
  },
  snpCov: (ctx, region, bpToX, viewWidth, state, scale) => {
    if (scale) {
      drawSnpSegmentsCanvas(
        ctx,
        region,
        bpToX,
        viewWidth,
        state,
        scale.normalize,
      )
    }
  },
  modCov: (ctx, region, bpToX, viewWidth, state, scale) => {
    if (scale) {
      drawModCoverageCanvas(
        ctx,
        region,
        bpToX,
        viewWidth,
        state,
        scale.normalize,
      )
    }
  },
  interbase: (ctx, region, bpToX, viewWidth, state, scale) => {
    if (scale) {
      drawInterbaseCanvas(ctx, region, bpToX, viewWidth, state, scale.domainMax)
    }
  },
  indicator: (ctx, region, bpToX, viewWidth, state) => {
    drawIndicatorCanvas(ctx, region, bpToX, viewWidth, state)
  },
}

function drawCoverage(
  ctx: Ctx2D,
  region: Canvas2DRegionData,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
  layers: CoverageLayer[],
  scale: CoverageScale | undefined,
) {
  const bpToX = (bp: number) => bpToScreenX(bp, block, bpLength, fullBlockWidth)
  const viewWidth = fullBlockWidth + block.screenStartPx
  // The coverage draw helpers anchor bars/segments/indicators at the canvas
  // top (clip-top). Shifting the whole band by coverageTopOffset lets grouped
  // sections scroll their coverage with the section; it is 0 (no-op) for the
  // ungrouped sticky-coverage path, mirroring the shader `covTop` uniform.
  ctx.save()
  ctx.translate(0, state.coverageTopOffset)
  try {
    // One scale for the whole band, built once per FRAME by the caller because
    // the bars, the SNP segments stacked inside them and the modification
    // segments are readings of one axis; each building its own normalizer is how
    // all three came to hardcode a zero floor and ignore `minScore`.
    for (const layer of layers) {
      CANVAS_COVERAGE_DRAW[layer.id](
        ctx,
        region,
        bpToX,
        viewWidth,
        state,
        scale,
      )
    }
  } finally {
    ctx.restore()
  }
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
  // Span, so order the edges: on a reversed block bpToScreenX flips (startBp
  // lands right of endBp), and a raw `x2 - x1` width goes negative. The raster
  // canvas tolerates that, but SvgCanvas would emit `width="-…"` and the box
  // silently vanished from SVG export. min/abs is the same rule every other
  // span here uses (render-core/CLAUDE.md).
  const left = Math.min(x1, x2)
  const w = Math.abs(x2 - x1)
  ctx.strokeRect(left, y, w, state.featureHeight)
}

// Selection only — the hover highlight is a React overlay (HighlightOverlay).
function drawSelectionOverlays(
  ctx: Ctx2D,
  region: Canvas2DRegionData,
  block: OverlayBlock,
  state: RenderState,
) {
  const bounds = getSelectionBounds(state, region)
  if (bounds) {
    paintSelectionBox(ctx, bounds, block, state)
  }
}
