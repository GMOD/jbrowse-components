import OverlayCanvas from '@jbrowse/render-core/OverlayCanvas'
import { observer } from 'mobx-react'

import { BandSeamHandle } from '../../shared/BandSeamHandle.tsx'
import { buildVariantLaneHit } from '../../shared/buildVariantHit.ts'
import { enrichFeatureFromClick } from '../../shared/enrichFeatureFromClick.ts'
import { frequencyTooltipRows } from '../../shared/frequencyBand.ts'
import { variantSurfaceHandlers } from '../../shared/variantSurface.ts'
import {
  genomicFrequencyColumnAt,
  matrixFrequencyColumnAt,
  paintGenomicFrequencyBand,
  paintMatrixFrequencyBand,
} from './frequencyBandLayout.ts'

import type { VariantTooltipFields } from '../../shared/buildVariantHit.ts'
import type { FrequencyColumns } from '../../shared/frequencyBand.ts'
import type { VariantFeatureInfo } from '../../shared/types.ts'
import type { VariantSurface } from '../../shared/variantSurface.ts'
import type {
  FrequencyColumnHit,
  LinearMultiSampleVariantDisplayModel,
} from '../model.ts'

interface FrequencyBandHit {
  hit: FrequencyColumnHit
  info: VariantFeatureInfo
  fields: VariantTooltipFields
}

function columnRecord(
  model: LinearMultiSampleVariantDisplayModel,
  { displayedRegionIndex, column }: FrequencyColumnHit,
):
  | { columns: FrequencyColumns; featureId: string; info: VariantFeatureInfo }
  | undefined {
  if (model.atGenomicPositions) {
    const region = model.placedRegionRows.get(displayedRegionIndex)
    const columns =
      model.regionFrequencyColumns.get(displayedRegionIndex)?.columns
    const featureId = region?.featureIdList[column]
    const info = featureId && region.featureGenotypeMap[featureId]
    return columns && featureId && info
      ? { columns, featureId, info }
      : undefined
  }
  const { cellData, matrixFrequencyColumns: columns } = model
  const info = cellData?.mode === 'matrix' && cellData.featureData[column]
  return columns && info
    ? { columns, featureId: info.featureId, info }
    : undefined
}

function getFrequencyBandHit(
  model: LinearMultiSampleVariantDisplayModel,
  x: number,
): FrequencyBandHit | undefined {
  const { matrixFrequencyColumns } = model
  const hit = model.atGenomicPositions
    ? genomicFrequencyColumnAt(
        model.regionFrequencyColumns,
        model.visibleRegions,
        x,
      )
    : matrixFrequencyColumns &&
      matrixFrequencyColumnAt(matrixFrequencyColumns, model.columnGeometry, x)
  const record = hit && columnRecord(model, hit)
  if (!hit || !record) {
    return undefined
  }
  const { columns, featureId, info } = record
  const rows = frequencyTooltipRows(
    columns,
    hit.column,
    model.renderingMode === 'phased',
  )
  return {
    hit,
    info,
    fields: {
      ...buildVariantLaneHit({
        info,
        featureId,
        displayedRegionIndex: model.atGenomicPositions
          ? hit.displayedRegionIndex
          : undefined,
      }),
      surface: 'frequencies',
      ...Object.fromEntries(rows.map(({ label, value }) => [label, value])),
    },
  }
}

/**
 * The band as a pointer surface: a hover reports the record and its column's
 * counts, a click opens the record and a right-click its menu, as a lane mark
 * does. `x` is the display's, since the band spans it; `y` plays no part.
 */
export function frequencyBandSurface(
  model: LinearMultiSampleVariantDisplayModel,
): VariantSurface<FrequencyBandHit> {
  return {
    getHit: x => getFrequencyBandHit(model, x),
    getTooltip: hit => hit.fields,
    enrich: hit => {
      const baseFeature = model.featureById(hit.fields.featureId)
      return baseFeature
        ? enrichFeatureFromClick(baseFeature, hit.info)
        : undefined
    },
    onHover: hit => {
      model.setHoveredFrequencyColumn(hit?.hit)
      model.setHoveredLaneMark(undefined)
      model.setHoveredCell(undefined)
      model.setHoveredMatrixCell(undefined)
    },
  }
}

/**
 * The frequency band: its own canvas directly above the rows, in the band
 * `topBands` reserved, with its click targets and its resize handle. Every
 * observable the draw needs is read in the render body, because `OverlayCanvas`
 * calls `draw` from an effect where nothing is tracked.
 */
const FrequencyBandOverlay = observer(function FrequencyBandOverlay({
  model,
}: {
  model: LinearMultiSampleVariantDisplayModel
}) {
  const { topBands, canvasWidthPx, atGenomicPositions } = model
  const { frequencyTop: top, frequencyHeight: height } = topBands
  const regions = atGenomicPositions ? model.regionFrequencyColumns : undefined
  const matrix = atGenomicPositions ? undefined : model.matrixFrequencyColumns
  const blocks = model.renderBlocks
  const geometry = model.columnGeometry
  return height > 0 ? (
    <div style={{ position: 'absolute', top, left: 0 }}>
      <OverlayCanvas
        width={canvasWidthPx}
        height={height}
        draw={ctx => {
          if (regions) {
            paintGenomicFrequencyBand(
              ctx,
              regions,
              blocks,
              canvasWidthPx,
              height,
            )
          } else if (matrix) {
            paintMatrixFrequencyBand(ctx, matrix, geometry, height)
          }
        }}
      />
      <div
        data-testid="variant_frequency_band"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: canvasWidthPx,
          height,
        }}
        {...variantSurfaceHandlers(model, frequencyBandSurface(model))}
      />
      <BandSeamHandle
        data-testid="variant_frequency_band_resize_handle"
        top={height}
        title="Drag to resize the genotype frequency band"
        onDrag={d => {
          model.setGenotypeFrequenciesHeight(model.topBands.frequencyHeight + d)
        }}
      />
    </div>
  ) : null
})

export default FrequencyBandOverlay
