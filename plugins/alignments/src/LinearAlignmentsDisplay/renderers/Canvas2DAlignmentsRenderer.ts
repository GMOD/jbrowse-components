import {
  forEachClippedBlock,
  prepareCanvas,
  spanRect,
  withClip,
} from '@jbrowse/render-core/canvas2dUtils'
import { planMarks } from '@jbrowse/render-core/marks'
import { Canvas2DRenderingBackendBase } from '@jbrowse/render-core/renderingBackendBase'

import { emptyArcsUploadData } from '../../features/arcs/types.ts'
import { emptyConnectingLinesUploadData } from '../../features/connectingLines/types.ts'
import { emptyLinkedReadLinesUploadData } from '../../features/linkedReads/types.ts'
import { emptyOverlapsUploadData } from '../../features/overlap/types.ts'
import {
  buildReadFields,
  emptyReadFields,
} from '../../features/read/buildRegion.ts'
import { getSelectionBounds } from '../components/chainOverlayUtils.ts'
import { paintArcBand } from './arcMarks.ts'
import { ALIGNMENTS_COVERAGE_MARKS } from './coverageMarks.ts'
import { PILEUP_MARKS } from './pileupMarks.ts'
import {
  bpToScreenX,
  pileupRowY,
  sectionRegionKey,
  sectionRenderState,
} from './rendererTypes.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { ArcsUploadData } from '../../features/arcs/types.ts'
import type { ConnectingLinesUploadData } from '../../features/connectingLines/types.ts'
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
import type {
  AlignmentsRenderingBackend,
  AlignmentsSources,
  CigarUploadData,
  RenderBlock,
  RenderState,
  SectionRender,
} from './rendererTypes.ts'
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
// [insertions | softclips | hardclips]: the insertion and clip marks declare
// their own slice of it, so the packer, the painter and the hit test bound
// their walks by one expression rather than three.
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
    interbaseTypes: data.interbaseTypes,
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
  interbaseTypes: new Uint8Array(0),
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
  // The density tier's bins, into section 0's keys — every other field empty,
  // so the pileup layers paint nothing and the band's depth-bar layer paints
  // the bins.
  for (const [regionIdx, coverage] of sources.densityRegions) {
    regions.set(sectionRegionKey(0, regionIdx), {
      ...EMPTY_PILEUP_FIELDS,
      ...coverage,
    })
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

  // Which marks draw this frame, resolved once. The gates read the
  // display-wide `state` (the show flags are the same in every section), so
  // asking them per section per block re-answered one question up to 120 times
  // a frame at MAX_GROUPS.
  const pileup = planMarks(PILEUP_MARKS, state)
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
    (sections, block, { scissorX, scissorW }) => {
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
              for (const mark of ALIGNMENTS_COVERAGE_MARKS) {
                mark.paintBlock(ctx, region, block, sectionState)
              }
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
            // The pileup marks in `PILEUP_MARKS` order — the GPU renderer draws
            // the same plan — with the per-section `sectionState`.
            for (const mark of pileup.marks) {
              mark.paintBlock(ctx, region, block, sectionState)
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
            // The same four marks in the same order the GPU draws, so a layer
            // cannot be reordered on one backend alone.
            paintArcBand(ctx, region, block, {
              ...sectionState,
              arcBand,
              screenWidthPx: scissorW,
            })
          })
        }
      }
    },
  )
  return painted
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
  // On a reversed block bpToScreenX flips (startBp lands right of endBp), and a
  // raw `x2 - x1` width goes negative. The raster canvas tolerates that, but
  // SvgCanvas would emit `width="-…"` and the box silently vanished from SVG
  // export.
  const { left, width } = spanRect(
    bp => bpToScreenX(bp, block, bpLength, fullBlockWidth),
    bounds.startBp,
    bounds.endBp,
  )
  const y = pileupRowY(bounds.yRow, state)
  ctx.strokeStyle = '#00b8ff'
  ctx.lineWidth = 2
  ctx.strokeRect(left, y, width, state.featureHeight)
}

// Selection only — the hover highlight is the chrome's guide (`hoverInk`).
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
