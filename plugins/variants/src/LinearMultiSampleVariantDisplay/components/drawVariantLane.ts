import { measureText } from '@jbrowse/core/util'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import {
  LABEL_FONT_SIZE,
  computeLabelPosition,
  truncateLabel,
} from '@jbrowse/plugin-canvas'
import { forEachClippedBlock } from '@jbrowse/render-core/canvas2dUtils'

import { LABEL_GAP_PX } from '../../shared/variantTopBands.ts'
import { forEachFeatureSpan } from './forEachFeatureSpan.ts'
import { drawVariantShape } from './variantShape.ts'

import type { VariantFeatureInfo } from '../../shared/types.ts'
import type { VariantTopBands } from '../../shared/variantTopBands.ts'
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
  // The names the lane letters its marks with. Read through the two the payload
  // already carries rather than as a third per-feature array: `featureIdList[f]`
  // is the record at index f and `featureGenotypeMap` already holds its `name`
  // for the tooltip. A names array beside them would be a second spelling of
  // one fact, and the one that goes stale.
  featureIdList: string[]
  featureGenotypeMap: Record<string, VariantFeatureInfo>
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
 * **Labels cull; they do not stack.** plugin-canvas resolves label overlap by
 * layout — `computeLabelExtraWidth` widens each feature's packed box so the
 * packer pushes a colliding neighbour onto another row — and a one-row lane has
 * no other row to push onto. So a label is drawn only if it clears the last one
 * drawn, greedily left to right. That degrades the right way: zoomed out, where
 * a cohort window holds fifty variants a few px apart, nothing is lettered and
 * the marks carry the information; zoomed in to a handful, every one is. The
 * text, its measured width, the font size and the left-edge clamps are all
 * plugin-canvas's, so a lettered mark reads identically to the same record in a
 * LinearVariantDisplay — only the collision rule differs, and it differs
 * because the question does.
 *
 * Shared by the on-screen overlay and the SVG export.
 */
export function drawVariantLane(
  ctx: Ctx2D,
  regions: ReadonlyMap<number, VariantLaneData>,
  blocks: VariantRenderBlock[],
  {
    canvasWidth,
    bands,
    labelColor,
    descriptionColor,
  }: {
    canvasWidth: number
    bands: VariantTopBands
    /** theme `text.primary`, as plugin-canvas letters a feature name with */
    labelColor: string
    /** theme `featureDescription`, its blue for the second line */
    descriptionColor: string
  },
) {
  const {
    laneHeight,
    markHeight,
    labelTop,
    labelsFit,
    showName,
    showDescription,
  } = bands
  if (laneHeight <= 0) {
    return
  }
  if (labelsFit) {
    ctx.font = `${LABEL_FONT_SIZE}px sans-serif`
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'
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
      // Right edge of the last label drawn, so the next one is only drawn if it
      // clears it. See the note above on why a lane culls rather than stacks.
      let lastLabelRight = Number.NEGATIVE_INFINITY
      // The shared per-record walk: the lane's marks and the insertion markers
      // over the cells come out of one geometry, so a mark cannot sit a pixel
      // off the column it names. `markHeight` is the band an insertion marker
      // is sized against here, the way a row height is for a cell.
      forEachFeatureSpan(region, block, markHeight, (f, span) => {
        const abgr = region.featureColors[f]!
        if (abgr !== currentAbgr) {
          ctx.fillStyle = abgrToCssRgba(abgr)
          currentAbgr = abgr
        }
        const width = Math.max(MIN_MARK_WIDTH_PX, span.width)
        // The cells' own glyph painter, so an inversion is the same
        // left-pointing triangle in the lane as in every row under it — and a
        // new shape lands in both at once instead of in whichever was
        // remembered.
        drawVariantShape(
          ctx,
          region.featureShapeTypes[f]!,
          span.left,
          0,
          width,
          markHeight,
        )
        if (labelsFit) {
          const featureInfo =
            region.featureGenotypeMap[region.featureIdList[f]!]
          // Name over description, plugin-canvas's stacking order and its two
          // colors — the name in the theme's text color, the description in
          // `featureDescription`. Truncated and measured with its helpers too,
          // so the same record letters identically in a LinearVariantDisplay.
          const name = showName ? truncateLabel(featureInfo?.name ?? '') : ''
          const description = showDescription
            ? truncateLabel(featureInfo?.description ?? '')
            : ''
          // The collision test is over the WIDEST line, so a long description
          // under a short name cannot run into the next record's text. One
          // decision for the pair, because they are drawn as a block.
          const nameWidth = name ? measureText(name, LABEL_FONT_SIZE) : 0
          const descWidth = description
            ? measureText(description, LABEL_FONT_SIZE)
            : 0
          const textWidth = Math.max(nameWidth, descWidth)
          if (textWidth > 0) {
            // plugin-canvas's anchoring, so a label in the lane sits where the
            // same record's label sits in a LinearVariantDisplay: left-aligned
            // to the mark, pushed right when the mark starts off-screen, and
            // held to the mark's right edge when it fits inside it.
            const { labelX } = computeLabelPosition(
              { relativeY: 0, textWidth },
              0,
              {
                featureLeftPx: span.left,
                featureRightPx: span.left + width,
                featureBottomPx: 0,
                screenStartPx: block.screenStartPx,
              },
            )
            if (labelX > lastLabelRight) {
              let y = labelTop
              if (name) {
                ctx.fillStyle = labelColor
                ctx.fillText(name, labelX, y)
                y += LABEL_FONT_SIZE
              }
              if (description) {
                ctx.fillStyle = descriptionColor
                ctx.fillText(description, labelX, y)
              }
              lastLabelRight = labelX + textWidth + LABEL_GAP_PX
              // the labels reset the fill, so the next mark must reassign it
              currentAbgr = -1
            }
          }
        }
      })
    },
  )
}
