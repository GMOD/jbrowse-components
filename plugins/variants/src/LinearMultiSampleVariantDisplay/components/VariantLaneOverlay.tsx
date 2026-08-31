import { hoverBoxStyle } from '@jbrowse/core/ui'
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import {
  isHitFeature,
  paintFeatureBand,
  performMultiRegionHitDetection,
} from '@jbrowse/plugin-canvas'
import OverlayCanvas from '@jbrowse/render-core/OverlayCanvas'
import { makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'
import { observer } from 'mobx-react'

import { buildVariantLaneHit } from '../../shared/buildVariantHit.ts'
import { enrichFeatureFromClick } from '../../shared/enrichFeatureFromClick.ts'
import { variantSurfaceHandlers } from '../../shared/variantSurface.ts'

import type { VariantTooltipFields } from '../../shared/buildVariantHit.ts'
import type { VariantSurface } from '../../shared/variantSurface.ts'
import type { LinearMultiSampleVariantDisplayModel } from '../model.ts'
import type { HitFeatureResult } from '@jbrowse/plugin-canvas'

interface VariantLaneHit {
  fields: VariantTooltipFields
  hit: HitFeatureResult
}

/**
 * The record under the cursor in the lane, through plugin-canvas's own hit test.
 *
 * Not a walk of our own: that hit test resolves overlap by paint order
 * ("whatever is drawn on top of the cursor wins") off the very indexes built
 * from the stack the band painted, and it widens each box by the label overhang
 * the layout reserved. A lane with a rule of its own disagreed with its own
 * pixels the moment two SVs overlapped — which on a real callset is most of
 * them.
 *
 * `mouseY` is relative to the band, and the band starts at the display's top, so
 * there is no scroll term: the lane does not scroll (the genotype rows do).
 */
function getHoveredLaneMark(
  model: LinearMultiSampleVariantDisplayModel,
  mouseX: number,
  mouseY: number,
): VariantLaneHit | undefined {
  const result = performMultiRegionHitDetection(
    model.laneLaidOutDataMap,
    model.laneFlatbushIndexes,
    model.visibleRegions,
    mouseX,
    mouseY,
  )
  if (!isHitFeature(result)) {
    return undefined
  }
  const { featureId } = result.feature
  const info = model.laneFeatureInfo(featureId)
  // The record's own tooltip table, the one the genotype cells show minus the
  // sample rows — `buildVariantLaneHit` leaves those empty, which is what lets
  // one hover slot serve both bands. plugin-canvas's `hoverTooltipRows` is the
  // alternative and says less: for a variant it resolves to the `mouseover`
  // slot, i.e. the ID this table already has a row for.
  return info
    ? {
        fields: buildVariantLaneHit({
          info,
          featureId,
          displayedRegionIndex: result.displayedRegionIndex,
        }),
        hit: result,
      }
    : undefined
}

/**
 * The lane as a pointer surface. Everything the genotype rows do — hover with
 * key dedup, click opens the feature widget, right-click opens the record menu
 * — so a mark in the lane and a cell in the column under it respond to the
 * same three gestures the same way.
 */
export function variantLaneSurface(
  model: LinearMultiSampleVariantDisplayModel,
): VariantSurface<VariantLaneHit> {
  return {
    getHit: (x, y) => getHoveredLaneMark(model, x, y),
    getTooltip: hit => hit.fields,
    // No third argument: a lane click names a record, not a sample, so the
    // widget opens without the "Sample:" card a cell click adds.
    enrich: hit => {
      const { featureId } = hit.fields
      const baseFeature = model.featureById(featureId)
      return baseFeature
        ? enrichFeatureFromClick(baseFeature, model.laneFeatureInfo(featureId))
        : undefined
    },
    onHover: hit => {
      model.setHoveredLaneMark(hit?.hit)
      model.setHoveredCell(undefined)
    },
  }
}

const HoveredMarkHighlight = observer(function HoveredMarkHighlight({
  model,
}: {
  model: LinearMultiSampleVariantDisplayModel
}) {
  const hit = model.hoveredLaneMark
  if (!hit) {
    return null
  }
  const region = model.visibleRegions.find(
    r => r.displayedRegionIndex === hit.displayedRegionIndex,
  )
  if (!region) {
    return null
  }
  // The box the layout placed, mapped by the region the pick resolved in — the
  // same numbers the painter drew from, so the box cannot land on a record other
  // than the one under the cursor. `startBp`/`endBp` are absolute.
  const toX = makeBpMapper(region)
  const x1 = toX(hit.feature.startBp)
  const x2 = toX(hit.feature.endBp)
  return (
    <div
      data-testid="variant_lane_hover_highlight"
      style={{
        position: 'absolute',
        left: Math.min(x1, x2),
        top: hit.feature.topPx,
        width: Math.max(1, Math.abs(x2 - x1)),
        height: hit.feature.bottomPx - hit.feature.topPx,
        ...hoverBoxStyle,
        pointerEvents: 'none',
        zIndex: 5,
      }}
    />
  )
})

/**
 * The lane's click targets, on a transparent layer over its canvas.
 *
 * A div rather than handlers on the canvas: `OverlayCanvas` is
 * `pointerEvents: 'none'` by construction, so a paint layer can never eat a
 * gesture meant for what is under it. The hover itself comes from the chrome's
 * pointer measurement (see `VariantDisplayComponent`), not from here.
 *
 * Its own component, and the one reading the hover, so a hover change
 * re-renders this and not `VariantLaneOverlay`: the overlay's `draw` closure
 * identity is what makes `OverlayCanvas` repaint, so a hover tick landing there
 * would redraw the whole band.
 */
const VariantLaneInteraction = observer(function VariantLaneInteraction({
  model,
}: {
  model: LinearMultiSampleVariantDisplayModel
}) {
  const { canvasWidthPx, topBands } = model
  return (
    <>
      <div
        data-testid="variant_lane"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: canvasWidthPx,
          height: topBands.laneHeight,
          cursor: model.hoveredLaneMark ? 'pointer' : undefined,
        }}
        {...variantSurfaceHandlers(model, variantLaneSurface(model))}
      />
      <HoveredMarkHighlight model={model} />
    </>
  )
})

/**
 * The variant lane: a `LinearVariantDisplay`-shaped band above the genotype rows,
 * drawn by plugin-canvas.
 *
 * Its own canvas rather than a strip of the genotype one: the rows scroll and
 * the lane does not, and the row canvas is sized to `availableHeight` precisely
 * so the two are separate scroll surfaces. Sitting outside the offset container
 * that holds the rows is what puts it in the band `topBands` reserved.
 *
 * The band is `paintFeatureBand` — that plugin's own band composition, geometry
 * then labels — over a stack its packer laid out and its fit ladder compacted
 * into `laneHeight` (see `laneFitStage`). So overlapping SVs stack onto rows
 * instead of overdrawing, paint order is what the hit test resolves by, and a
 * label is placed by the layout that reserved room for it rather than culled left
 * to right by a rule of the lane's own. The export runs the same call, which is
 * what stops the two from lettering the same records differently.
 *
 * Every observable the draw needs is read here in the render body rather than
 * inside the closure, because `OverlayCanvas` calls `draw` from an effect where
 * nothing is tracked — the same rule `VariantInsertionGlyphOverlay` follows, and
 * what makes a refetch, a pan or a band resize repaint.
 */
const VariantLaneOverlay = observer(function VariantLaneOverlay({
  model,
}: {
  model: LinearMultiSampleVariantDisplayModel
}) {
  const palette = usePalette()
  const {
    laneLaidOutDataMap,
    laneRenderedLabels,
    laneFontSize,
    renderBlocks,
    visibleRegions,
    topBands,
    canvasWidthPx,
  } = model
  const { laneHeight } = topBands
  return laneHeight > 0 ? (
    <div style={{ position: 'absolute', top: 0, left: 0 }}>
      <OverlayCanvas
        // `canvasWidthPx` for the same reason the glyph overlay uses it: it is
        // the width the blocks were mapped into, and it is the scissor bound
        // inside the draw below.
        width={canvasWidthPx}
        height={laneHeight}
        draw={ctx => {
          paintFeatureBand(
            ctx,
            laneLaidOutDataMap,
            renderBlocks,
            visibleRegions,
            {
              canvasWidth: canvasWidthPx,
              bandHeight: laneHeight,
              ...laneRenderedLabels,
              fontSize: laneFontSize,
              palette,
            },
          )
        }}
      />
      <VariantLaneInteraction model={model} />
    </div>
  ) : null
})

export default VariantLaneOverlay
