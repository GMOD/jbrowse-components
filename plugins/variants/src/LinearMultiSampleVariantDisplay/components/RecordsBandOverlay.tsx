import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import {
  paintFeatureBand,
  performMultiRegionHitDetection,
} from '@jbrowse/plugin-features/band'
import OverlayCanvas from '@jbrowse/render-core/OverlayCanvas'
import { observer } from 'mobx-react'

import { BandSeamHandle } from '../../shared/BandSeamHandle.tsx'
import { buildRecordHit } from './buildVariantHit.ts'
import { enrichFeatureFromClick } from './enrichFeatureFromClick.ts'
import { variantSurfaceHandlers } from './variantSurface.ts'

import type { LinearMultiSampleVariantDisplayModel } from '../model.ts'
import type { VariantTooltipFields } from './buildVariantHit.ts'
import type { VariantSurface } from './variantSurface.ts'
import type { HitFeatureResult } from '@jbrowse/plugin-features/band'

interface RecordHit {
  fields: VariantTooltipFields
  hit: HitFeatureResult
}

/**
 * The record under the cursor, through plugin-features's own hit test, which
 * resolves overlap by paint order off the indexes built from the stack the
 * band painted. `mouseY` is relative to the band, which starts at the
 * display's top and does not scroll.
 */
function getHoveredRecord(
  model: LinearMultiSampleVariantDisplayModel,
  mouseX: number,
  mouseY: number,
): RecordHit | undefined {
  const result = performMultiRegionHitDetection(
    model.recordsLaidOutDataMap,
    model.recordsFlatbushIndexes,
    model.host.visibleRegions,
    mouseX,
    mouseY,
  )
  const info = result && model.featureInfoById(result.feature.featureId)
  return result && info
    ? {
        fields: buildRecordHit({
          info,
          featureId: result.feature.featureId,
          displayedRegionIndex: result.displayedRegionIndex,
          carriers: model.recordCarriers.get(result.feature.featureId),
        }),
        hit: result,
      }
    : undefined
}

/**
 * The records band as a pointer surface: hover, click to the feature widget
 * and right-click to the record menu, as a genotype cell responds. A click
 * names a record and no sample, so the widget opens without a "Sample:" card.
 */
export function recordsBandSurface(
  model: LinearMultiSampleVariantDisplayModel,
): VariantSurface<RecordHit> {
  return {
    getHit: (x, y) => getHoveredRecord(model, x, y),
    getTooltip: hit => hit.fields,
    enrich: hit => {
      const { featureId } = hit.fields
      const baseFeature = model.featureById(featureId)
      return baseFeature
        ? enrichFeatureFromClick(baseFeature, model.featureInfoById(featureId))
        : undefined
    },
    onHover: hit => {
      model.setHoveredRecord(hit?.hit)
      model.setHoveredCell(undefined)
    },
  }
}

/**
 * The band's click targets, on a transparent layer over its canvas, since
 * `OverlayCanvas` is `pointerEvents: 'none'`. Its own observer reading the
 * hover, so a hover tick re-renders it and not the painted band.
 */
const RecordsBandInteraction = observer(function RecordsBandInteraction({
  model,
}: {
  model: LinearMultiSampleVariantDisplayModel
}) {
  const { canvasWidthPx, topBands } = model
  return (
    <div
      data-testid="records_band"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: canvasWidthPx,
        height: topBands.recordsHeight,
        cursor: model.hoveredRecord ? 'pointer' : undefined,
      }}
      {...variantSurfaceHandlers(model, recordsBandSurface(model))}
    />
  )
})

/**
 * The records band above the genotype rows, painted by plugin-features's
 * `paintFeatureBand` over the stack its packer laid out and its fit ladder
 * kept (`recordsFitStage`). Its own canvas, outside the rows' offset
 * container, because the rows scroll and the band does not. Every observable
 * the draw needs is read in the render body: `OverlayCanvas` calls `draw` from
 * an effect, where nothing is tracked.
 */
const RecordsBandOverlay = observer(function RecordsBandOverlay({
  model,
}: {
  model: LinearMultiSampleVariantDisplayModel
}) {
  const palette = usePalette()
  const {
    recordsLaidOutDataMap,
    recordsRenderedLabels,
    recordsFontSize,
    renderBlocks,
    topBands,
    canvasWidthPx,
  } = model
  const { visibleRegions } = model.host
  const { recordsHeight } = topBands
  return recordsHeight > 0 ? (
    // sized, because every child is absolute and the seam handle spans its
    // parent's width: a 0px box leaves nothing to grab
    <div
      data-testid="records_band_box"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: canvasWidthPx,
        height: recordsHeight,
      }}
    >
      <OverlayCanvas
        width={canvasWidthPx}
        height={recordsHeight}
        draw={ctx => {
          paintFeatureBand(
            ctx,
            recordsLaidOutDataMap,
            renderBlocks,
            visibleRegions,
            {
              canvasWidth: canvasWidthPx,
              bandHeight: recordsHeight,
              ...recordsRenderedLabels,
              fontSize: recordsFontSize,
              palette,
            },
          )
        }}
      />
      <RecordsBandInteraction model={model} />
      {/* the target is the reserved height plus the delta, read in the
          callback, so a cap above the stack drags from what is drawn; with
          no rows the band is the display, resized by the track's own handle */}
      {model.recordsOnly ? null : (
        <BandSeamHandle
          data-testid="records_band_resize_handle"
          top={recordsHeight}
          title="Drag to resize the records band"
          onDrag={d => {
            const { recordsHeight } = model.topBands
            const cap = model.recordsGrowMaxHeight
            // a band already as tall as its stack cannot grow, so a drag down
            // leaves the cap where it is rather than lowering it to the stack
            model.setRecordsGrowMaxHeight(
              d > 0 && recordsHeight < cap ? cap : recordsHeight + d,
            )
          }}
        />
      )}
    </div>
  ) : null
})

export default RecordsBandOverlay
