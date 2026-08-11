import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import {
  LABEL_BASELINE_RATIO,
  LABEL_FONT_SIZE,
  LABEL_PADDING_PX,
  computeLabelPosition,
  createFeatureFloatingLabels,
} from '@jbrowse/plugin-canvas'
import { forEachClippedBlock } from '@jbrowse/render-core/canvas2dUtils'

import { forEachFeatureSpan } from './forEachFeatureSpan.ts'
import { drawVariantShape } from './variantShape.ts'

import type { VariantFeatureInfo } from '../../shared/types.ts'
import type { VariantTopBands } from '../../shared/variantTopBands.ts'
import type { VariantRenderBlock } from './variantRenderingBackendTypes.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
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
 * therefore sits exactly above its column of genotypes, down to the same
 * pixel-snapped 2px floor, and an insertion widens past its reference span the
 * same way `drawVariantInsertionGlyphs` widens one below. Two spans computed two
 * ways is how a lane ends up one pixel off its own data at some zooms and looks
 * like a rendering bug.
 *
 * An insertion's widened extent is the one number that is *not* identical to the
 * cells', and deliberately: `insertionBarWidth` sizes a marker against the band
 * it is drawn in, so the lane passes `markHeight` where the cells pass their
 * drawn row height. On a 2504-sample callset those rows are under the 5px that
 * gates the marker's wide count-label form, so the lane draws the wide marker
 * over cells drawing the narrow bar — each sized for the band a reader is
 * actually looking at, which is the point of the parameter.
 *
 * **Labels cull; they do not stack.** plugin-canvas resolves label overlap by
 * layout — `computeLabelExtraWidth` widens each feature's packed box so the
 * packer pushes a colliding neighbour onto another row — and a one-row lane has
 * no other row to push onto. So a label is drawn only if it clears the last one
 * drawn, greedily left to right. That degrades the right way: zoomed out, where
 * a cohort window holds fifty variants a few px apart, nothing is lettered and
 * the marks carry the information; zoomed in to a handful, every one is. The
 * text, its truncation, its color, its measured width, the font size, the gap
 * two labels clear by and the left-edge clamps are all plugin-canvas's
 * (`createFeatureFloatingLabels`, `LABEL_PADDING_PX`, `computeLabelPosition`),
 * so a lettered mark reads identically to the same record in a
 * LinearVariantDisplay — only the collision *rule* differs, and it differs
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
    insertionsWiden,
    palette,
  }: {
    canvasWidth: number
    bands: VariantTopBands
    /**
     * The display's `showInsertionGlyphs`. With it off an insertion is drawn at
     * the 2px floor like a SNP, in the rows and therefore here — a wide mark
     * over a 2px column names a span the display is deliberately not showing.
     */
    insertionsWiden: boolean
    /**
     * The palette the labels take their two colors from — `text.primary` for a
     * name and `featureDescription` for the line under it. Passed whole rather
     * than as two resolved colors so the pairing stays plugin-canvas's: on
     * screen this is the live theme's, and the SVG export hands over the
     * *export* theme's instead.
     */
    palette: JBrowsePalette
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
  // Where the first line's BASELINE goes. `fillText` takes a baseline, and
  // plugin-canvas positions a label by the top of its line box, so this is the
  // same conversion its SVG export makes (`labelY + fontSize *
  // LABEL_BASELINE_RATIO`) — and the reason the lane does not just set
  // `textBaseline: 'top'`. That put the whole line ~1px lower than the same
  // record's label in a LinearVariantDisplay, on top of pushing its descenders
  // into the canvas edge.
  const firstBaseline = labelTop + LABEL_FONT_SIZE * LABEL_BASELINE_RATIO
  if (labelsFit) {
    ctx.font = `${LABEL_FONT_SIZE}px sans-serif`
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'left'
  }
  // Right edge of the last label drawn, so the next one is only drawn if it
  // clears it. See the note above on why a lane culls rather than stacks.
  //
  // Outside the block loop, because blocks are adjacent on screen and the cull
  // is about pixels, not about regions: reset per block, the first label of a
  // region always drew, so a whole-genome view collided one against the last
  // label of the region left of it at every boundary. Blocks arrive in screen
  // order, which is what makes one running edge enough.
  let lastLabelRight = Number.NEGATIVE_INFINITY
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
      // "not one of ours", which no packed ABGR can be. Per block, unlike the
      // label edge above: `forEachClippedBlock` restores the context around each
      // one, so a remembered fillStyle would be a lie by the next block.
      let currentAbgr = -1
      // The shared per-record walk: the lane's marks and the insertion markers
      // over the cells come out of one geometry, so a mark cannot sit a pixel
      // off the column it names. `markHeight` is the band an insertion marker
      // is sized against here, the way a row height is for a cell.
      forEachFeatureSpan(
        region,
        block,
        { drawnHeight: markHeight, insertionsWiden },
        (f, span) => {
          const abgr = region.featureColors[f]!
          if (abgr !== currentAbgr) {
            ctx.fillStyle = abgrToCssRgba(abgr)
            currentAbgr = abgr
          }
          // `variantCellSpanPx` already floors the span at the shader's snapped
          // 2px, so a whole-chromosome zoom that puts every SNP under a pixel
          // still draws each of them: a lane that silently dropped records would
          // be worse than one that overplots.
          const width = span.width
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
            // The whole text half in one plugin-canvas call, so the same record
            // letters identically here and in a `LinearVariantDisplay`: a name
            // truncated by length and a description by *rendered width*, a blank
            // or `.` ID dropped rather than drawn, both measured at
            // LABEL_FONT_SIZE, and the theme's two label colors — the name in
            // `text.primary` over the description in `featureDescription`. The
            // mode's kinds are applied by withholding the input, which is also
            // what makes a name-less record letter with its description alone.
            const { nameLabel, descriptionLabel } = createFeatureFloatingLabels(
              {
                name: showName ? featureInfo?.name : undefined,
                description: showDescription
                  ? featureInfo?.description
                  : undefined,
                palette,
              },
            )
            // The collision test is over the WIDEST line, so a long description
            // under a short name cannot run into the next record's text. One
            // decision for the pair, because they are drawn as a block.
            const textWidth = Math.max(
              nameLabel?.textWidth ?? 0,
              descriptionLabel?.textWidth ?? 0,
            )
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
                let y = firstBaseline
                if (nameLabel) {
                  ctx.fillStyle = nameLabel.color
                  ctx.fillText(nameLabel.text, labelX, y)
                  y += LABEL_FONT_SIZE
                }
                if (descriptionLabel) {
                  ctx.fillStyle = descriptionLabel.color
                  ctx.fillText(descriptionLabel.text, labelX, y)
                }
                // `LABEL_PADDING_PX`, the same gap plugin-canvas reserves around a
                // packed label: it is what absorbs measureText's disagreement with
                // the font actually rendered, which is why a smaller gap here let
                // two lane labels touch even though the arithmetic said they
                // cleared.
                lastLabelRight = labelX + textWidth + LABEL_PADDING_PX
                // the labels reset the fill, so the next mark must reassign it
                currentAbgr = -1
              }
            }
          }
        },
      )
    },
  )
}
