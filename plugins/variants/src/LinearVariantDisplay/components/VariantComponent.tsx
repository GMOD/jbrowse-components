import { sidebarCovers } from '@jbrowse/display-ui'
import { backingScale, regionAtPixel } from '@jbrowse/render-core/canvas2dUtils'
import { observer } from 'mobx-react'

import { cellHit } from './buildVariantHit.ts'
import { enrichCellHit } from './enrichFeatureFromClick.ts'
import { pickVariantCell } from './pickVariantCell.ts'
import { computeVariantHitQuery, featuresNearCursor } from './variantHitTest.ts'
import { variantSurfaceHandlers } from './variantSurface.ts'

import type { VariantFeatureInfo } from '../../shared/types.ts'
import type { LinearVariantDisplayModel } from '../model.ts'
import type { VariantTooltipFields } from './buildVariantHit.ts'
import type { VariantSurface } from './variantSurface.ts'

export interface HoveredCell {
  cellIndex: number
  displayedRegionIndex: number
}

interface VariantHit {
  fields: VariantTooltipFields
  featureInfo: VariantFeatureInfo
  cell: HoveredCell
}

// `mouseX`/`mouseY` are relative to the rows canvas, which sits at
// `rowsTopOffset` inside the display — the caller has already subtracted it.
function getHoveredFeature(
  model: LinearVariantDisplayModel,
  mouseX: number,
  mouseY: number,
): VariantHit | undefined {
  const { cellData } = model
  if (!cellData) {
    return undefined
  }

  const region = regionAtPixel(model.host.visibleRegions, mouseX)
  if (!region) {
    return undefined
  }

  // Through perRegionCellMap, the model's one walk of the payload, rather than
  // indexing perRegionCellData again here — that second path could see a
  // region set the canvas and the glyph overlay did not.
  const regionCellData = model.perRegionCellMap.get(region.displayedRegionIndex)
  const { rowUnmap } = model
  if (!regionCellData || !rowUnmap) {
    return undefined
  }

  const query = computeVariantHitQuery(
    region,
    mouseX,
    mouseY,
    model.scrollTop,
    model.effectiveRowHeight,
    backingScale(model.renderState.canvasHeight),
  )
  const picked = pickVariantCell({
    data: regionCellData,
    block: { ...region, reversed: region.reversed ?? false },
    state: model.renderState,
    candidateFeatures: featuresNearCursor(
      regionCellData.featureIndexData,
      query,
    ),
    mouseX,
    mouseY,
    rowNearest: query.rowNearest,
    rowLowest: query.rowLowest,
    rowUnmap,
  })
  if (!picked) {
    return undefined
  }

  // The picked row indexes model.drawnRows directly (the order the cells were
  // placed in), so no per-region sourceNameList is shipped over RPC.
  const { cellIndex, featureIndex, rowIndex } = picked
  const { displayedRegionIndex } = region
  const info = regionCellData.featureInfo[featureIndex]!
  const fields = cellHit({
    drawnRows: model.drawnRows,
    genotypeDict: cellData.genotypeDict,
    sampleIndex: model.genotypeSampleIndex!,
    info,
    rowIndex,
    altDosage: regionCellData.cellAltDosage[cellIndex]!,
    displayedRegionIndex,
  })
  return (
    fields && {
      fields,
      featureInfo: info,
      cell: { cellIndex, displayedRegionIndex },
    }
  )
}

/**
 * The genotype rows as a pointer surface: hover, click and right-click all
 * resolve through `getHoveredFeature`, so the tooltip, the widget and the menu
 * cannot name different cells. None of them hits under the sidebar, whose own
 * hit box stacking above the canvas is then not what keeps them off it.
 */
export function variantRowsSurface(
  model: LinearVariantDisplayModel,
): VariantSurface<VariantHit> {
  return {
    getHit: (x, y) =>
      sidebarCovers(model.sidebarBounds, x, y + model.rowsTopOffset)
        ? undefined
        : getHoveredFeature(model, x, y),
    getTooltip: hit => hit.fields,
    enrich: hit => enrichCellHit(model, hit),
    onHover: hit => {
      model.setHovered(hit && { kind: 'cell', cell: hit.cell })
    },
  }
}

// The per-sample variant canvas + its click targets. DisplayChrome owns the GPU
// backend, the terminal states and the pointer measurement the hover comes
// from, handing the live canvas down here. Scroll is virtual: a fixed canvas,
// everything positioned from `model.scrollTop`, and the scroll affordances on
// the `RowsPanel` around this.
const VariantBody = observer(function VariantBody({
  model,
  canvasRef,
}: {
  model: LinearVariantDisplayModel
  canvasRef: (node: HTMLCanvasElement | null) => void
}) {
  // `canvasWidthPx`, not a second `view.trackWidthPx` read: it is the width
  // `renderState.canvasWidth` carries, so the canvas below and every overlay
  // beside it sit in the box the cells were actually mapped into. The getter
  // exists to be the one answer — reading the view directly is how MAF drifted
  // onto `view.width` (see MultiRegionDisplayMixin.canvasWidthPx).
  const width = model.canvasWidthPx

  return (
    <canvas
      role="img"
      aria-label="Variant genotypes"
      data-testid="variant_canvas"
      ref={canvasRef}
      style={{
        width,
        height: model.availableHeight,
        position: 'absolute',
        left: 0,
        top: 0,
        backgroundColor: model.rowBackground || undefined,
      }}
      {...variantSurfaceHandlers(model, variantRowsSurface(model))}
    />
  )
})

export default VariantBody
