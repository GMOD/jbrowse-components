import {
  forEachClippedBlock,
  prepareCanvas,
  withClip,
} from '@jbrowse/render-core/canvas2dUtils'
import { planMarks } from '@jbrowse/render-core/marks'
import { Canvas2DRenderingBackendBase } from '@jbrowse/render-core/renderingBackendBase'

import { emptyArcsUploadData } from '../../features/arcs/types.ts'
import { paintArcBand } from './arcMarks.ts'
import {
  ALIGNMENTS_COVERAGE_MARKS,
  coverageRegionOf,
  emptyCoverageRegion,
} from './coverageMarks.ts'
import { PILEUP_MARKS } from './pileupMarks.ts'
import { sectionRegionKey, sectionRenderState } from './rendererTypes.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { ArcsUploadData } from '../../features/arcs/types.ts'
import type { AlignmentsCoverageRegion } from './coverageMarks.ts'
import type {
  AlignmentsRenderingBackend,
  AlignmentsSources,
  RenderBlock,
  RenderState,
  SectionRender,
} from './rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// One region key's three feeds: the laid-out payload the pileup marks read,
// absent for an arcs-only or density region; the coverage band's region, built
// the way the GPU renderer builds it; and the arc band's feed.
export interface Canvas2DRegion {
  pileup: PileupDataResult | undefined
  coverage: AlignmentsCoverageRegion
  arcs: ArcsUploadData
}

const EMPTY_ARCS = emptyArcsUploadData()

/**
 * Pure builder: turns the model's observable per-section inputs into the
 * regions map that `drawAlignmentBlocks` consumes, keyed by `sectionRegionKey`
 * so stacked groups don't collide. The on-screen Canvas2DAlignmentsRenderer.sync
 * calls this directly, so on-screen and SVG export share one builder. Section 0
 * keys equal the raw region index, so ungrouped is byte-identical.
 */
export function buildAlignmentsRegionMap(sources: AlignmentsSources) {
  const regions = new Map<number, Canvas2DRegion>()
  sources.sections.forEach((section, s) => {
    for (const [regionIdx, data] of section.laidOutPileupMap) {
      regions.set(sectionRegionKey(s, regionIdx), {
        pileup: data,
        coverage: coverageRegionOf(data),
        arcs: section.arcsRpcDataMap.get(regionIdx) ?? EMPTY_ARCS,
      })
    }
    // Arc-only regions (arcs arrived for a region with no pileup) attach to
    // this same section.
    for (const [regionIdx, arcs] of section.arcsRpcDataMap) {
      if (!section.laidOutPileupMap.has(regionIdx)) {
        regions.set(sectionRegionKey(s, regionIdx), {
          pileup: undefined,
          coverage: emptyCoverageRegion(),
          arcs,
        })
      }
    }
  })
  // The density tier's bins, into section 0's keys, where the band's depth-bar
  // layer paints them.
  for (const [regionIdx, coverage] of sources.densityRegions) {
    regions.set(sectionRegionKey(0, regionIdx), {
      pileup: undefined,
      coverage: { ...emptyCoverageRegion(), ...coverage },
      arcs: EMPTY_ARCS,
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
  private regions: ReadonlyMap<number, Canvas2DRegion> = new Map()

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
 * insertions, soft/hard clips and modifications. The hover and the selection
 * are the chrome's guide and are not painted here or exported.
 *
 * No `this`, no DOM, no DPR scaling — just data → ctx. The on-screen
 * Canvas2DAlignmentsRenderer wraps this with prepareCanvas + lifecycle
 * upload state; renderSvg.tsx calls it directly with an SvgCanvas.
 */
export function drawAlignmentBlocks(
  ctx: Ctx2D,
  regions: ReadonlyMap<number, Canvas2DRegion>,
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
            region: Canvas2DRegion
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
                mark.paintBlock(ctx, region.coverage, block, sectionState)
              }
            },
          )
        }

        const { pileup: pileupRegion } = region
        if (pileupRegion) {
          withClip(
            ctx,
            scissorX,
            sec.pileupClipTop,
            scissorW,
            sec.pileupClipHeight,
            () => {
              // The pileup marks in `PILEUP_MARKS` order — the GPU renderer
              // draws the same plan — with the per-section `sectionState`.
              for (const mark of pileup.marks) {
                mark.paintBlock(ctx, pileupRegion, block, sectionState)
              }
            },
          )
        }

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
            paintArcBand(ctx, region.arcs, block, {
              ...sectionState,
              arcBand,
            })
          })
        }
      }
    },
  )
  return painted
}
