import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import {
  forEachClippedBlock,
  makeBpMapper,
} from '@jbrowse/render-core/canvas2dUtils'

import { variantCellSpanPx } from './variantCellSpan.ts'

import type { VariantRenderBlock } from './variantRenderingBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

/**
 * The per-region fields the lane reads, declared structurally rather than as
 * `VariantCellData` for the same reason `VariantInsertionGlyphData` is: the main
 * thread holds the *shipped* form. Everything here is per **feature** — the lane
 * draws one mark per record, not one per genotype — so it never touches a cell
 * array, and a 2504-sample callset costs it exactly what a 1-sample one does.
 */
export interface VariantLaneData {
  featurePositions: Uint32Array
  featureInsertedBp: Int32Array
  featureColors: Uint32Array
}

// Sub-pixel marks would antialias to nothing at the lane's typical zoom, and a
// variant lane that silently drops records is worse than one that overplots, so
// the floor is a whole pixel rather than the cells' snapped 2px band. (The cells
// below use `snappedCellWidthPx` because they are stacked thousands deep and
// pixel-snapping is what keeps a column from shimmering as you pan; a single
// row of marks has no such neighbour to align to.)
const MIN_MARK_WIDTH_PX = 1

/**
 * The variant lane: every fetched record drawn once, at its genomic span, in the
 * band above the genotype rows.
 *
 * This is the half of a `LinearVariantDisplay` that a genotype matrix is missing
 * — "which variant is this column" — without a second track, a second fetch, or
 * a second display model. The data is already in hand: `computeVariantCells`
 * ships `featurePositions` for the hit test and `featureColors` alongside it, so
 * the lane is a walk of numFeatures (thousands) rather than numCells (millions).
 *
 * Geometry is deliberately `variantCellSpanPx`, the cells' own: a record's mark
 * therefore sits exactly above its column of genotypes, and an insertion widens
 * in the lane exactly as `drawVariantInsertionGlyphs` widens it below. Two
 * spans computed two ways is how a lane ends up one pixel off its own data at
 * some zooms and looks like a rendering bug.
 *
 * Shared by the on-screen overlay and the SVG export.
 */
export function drawVariantLane(
  ctx: Ctx2D,
  regions: ReadonlyMap<number, VariantLaneData>,
  blocks: VariantRenderBlock[],
  { canvasWidth, laneHeight }: { canvasWidth: number; laneHeight: number },
) {
  if (laneHeight <= 0) {
    return
  }
  forEachClippedBlock(
    ctx,
    blocks,
    canvasWidth,
    laneHeight,
    block => {
      const region = regions.get(block.displayedRegionIndex)
      return region?.featureColors.length ? region : undefined
    },
    (region, block) => {
      const toX = makeBpMapper(block)
      const pxPerBp =
        (block.screenEndPx - block.screenStartPx) / (block.end - block.start)
      const numFeatures = region.featureColors.length
      // The color the context currently holds, so a run of records sharing one
      // (every record, whenever no `featureColor` override is set — the common
      // case) neither rebuilds the CSS string nor reassigns fillStyle. -1 is
      // "not one of ours", which no packed ABGR can be.
      let currentAbgr = -1
      for (let f = 0; f < numFeatures; f++) {
        const { left, width } = variantCellSpanPx({
          x1: toX(region.featurePositions[f * 2]!),
          x2: toX(region.featurePositions[f * 2 + 1]!),
          insertedBp: region.featureInsertedBp[f]!,
          pxPerBp,
          // The lane's own height is what an insertion marker in it is sized
          // against, the same way a cell's marker is sized against the cell.
          drawnRowHeight: laneHeight,
        })
        const abgr = region.featureColors[f]!
        if (abgr !== currentAbgr) {
          ctx.fillStyle = abgrToCssRgba(abgr)
          currentAbgr = abgr
        }
        ctx.fillRect(left, 0, Math.max(MIN_MARK_WIDTH_PX, width), laneHeight)
      }
    },
  )
}
