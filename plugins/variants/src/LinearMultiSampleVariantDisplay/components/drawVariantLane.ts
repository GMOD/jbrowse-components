import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import { forEachClippedBlock } from '@jbrowse/render-core/canvas2dUtils'

import { forEachFeatureSpan } from './forEachFeatureSpan.ts'
import { drawVariantShape } from './variantShape.ts'

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
  featureShapeTypes: Uint8Array
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
      // The color the context currently holds, so a run of records sharing one
      // (every record, whenever no `featureColor` override is set — the common
      // case) neither rebuilds the CSS string nor reassigns fillStyle. -1 is
      // "not one of ours", which no packed ABGR can be.
      let currentAbgr = -1
      // The shared per-record walk: the lane's marks and the insertion markers
      // over the cells come out of one geometry, so a mark cannot sit a pixel
      // off the column it names. `laneHeight` is the band an insertion marker
      // is sized against here, the way a row height is for a cell.
      forEachFeatureSpan(region, block, laneHeight, (f, span) => {
        const abgr = region.featureColors[f]!
        if (abgr !== currentAbgr) {
          ctx.fillStyle = abgrToCssRgba(abgr)
          currentAbgr = abgr
        }
        // The cells' own glyph painter, so an inversion is the same
        // left-pointing triangle in the lane as in every row under it — and a
        // new shape lands in both at once instead of in whichever was
        // remembered.
        drawVariantShape(
          ctx,
          region.featureShapeTypes[f]!,
          span.left,
          0,
          Math.max(MIN_MARK_WIDTH_PX, span.width),
          laneHeight,
        )
      })
    },
  )
}
