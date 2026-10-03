import {
  CANVAS_SEAM_PX,
  forEachClippedBlock,
  makeBpMapper,
  regionAtPixel,
} from '@jbrowse/render-core/canvas2dUtils'

import {
  frequencyBarBox,
  paintFrequencyColumn,
} from '../../shared/frequencyBand.ts'
import { snapVariantCellX } from './snapVariantCellX.ts'
import { HIT_TOLERANCE_PX } from './variantHitTest.ts'

import type {
  FrequencyColumns,
  FrequencyCtx,
} from '../../shared/frequencyBand.ts'
import type { VariantRenderBlock } from './variantRenderingBackendTypes.ts'
import type { ClipContext2D } from '@jbrowse/render-core/canvas2dUtils'
import type { BpRegionBounds } from '@jbrowse/render-core/renderBlock'

export interface GenomicFrequencyRegion {
  columns: FrequencyColumns
  // absolute (start, end) per column, the cells' own `featurePositions`
  featurePositions: Uint32Array
}

export interface MatrixColumnGeometry {
  left: number
  columnWidth: number
}

/** The extent column `c` paints in its block: the cells' snapped span. */
export function genomicColumnX(
  toX: (bp: number) => number,
  featurePositions: Uint32Array,
  c: number,
) {
  return snapVariantCellX(
    toX(featurePositions[c * 2]!),
    toX(featurePositions[c * 2 + 1]!),
  )
}

export function paintGenomicFrequencyBand(
  ctx: FrequencyCtx & ClipContext2D,
  regions: ReadonlyMap<number, GenomicFrequencyRegion>,
  blocks: readonly VariantRenderBlock[],
  canvasWidth: number,
  height: number,
) {
  const box = frequencyBarBox(height)
  forEachClippedBlock(
    ctx,
    blocks,
    canvasWidth,
    height,
    block => regions.get(block.displayedRegionIndex),
    ({ columns, featurePositions }, block) => {
      const toX = makeBpMapper(block)
      for (let c = 0; c < columns.numColumns; c++) {
        const { x, width } = genomicColumnX(toX, featurePositions, c)
        paintFrequencyColumn(ctx, columns, c, x, width, box)
      }
    },
  )
}

export function paintMatrixFrequencyBand(
  ctx: FrequencyCtx,
  columns: FrequencyColumns,
  { left, columnWidth }: MatrixColumnGeometry,
  height: number,
) {
  const box = frequencyBarBox(height)
  for (let c = 0; c < columns.numColumns; c++) {
    paintFrequencyColumn(
      ctx,
      columns,
      c,
      left + c * columnWidth,
      columnWidth + CANVAS_SEAM_PX,
      box,
    )
  }
}

/**
 * The column under `x` at genomic positions: the one painted last among those
 * whose extent is within the click tolerance, as the paint order puts it on top.
 */
export function genomicFrequencyColumnAt(
  regions: ReadonlyMap<number, GenomicFrequencyRegion>,
  visibleRegions: readonly (BpRegionBounds & {
    displayedRegionIndex: number
  })[],
  x: number,
) {
  const block = regionAtPixel(visibleRegions, x)
  const region = block && regions.get(block.displayedRegionIndex)
  if (!block || !region) {
    return undefined
  }
  const toX = makeBpMapper(block)
  let best = -1
  let bestDistance = HIT_TOLERANCE_PX
  for (let c = 0; c < region.columns.numColumns; c++) {
    const span = genomicColumnX(toX, region.featurePositions, c)
    const distance = Math.max(0, span.x - x, x - (span.x + span.width))
    if (distance <= bestDistance) {
      best = c
      bestDistance = distance
    }
  }
  return best === -1
    ? undefined
    : { displayedRegionIndex: block.displayedRegionIndex, column: best }
}

export function matrixFrequencyColumnAt(
  columns: FrequencyColumns,
  { left, columnWidth }: MatrixColumnGeometry,
  x: number,
) {
  const column = Math.floor((x - left) / columnWidth)
  return column >= 0 && column < columns.numColumns
    ? { displayedRegionIndex: 0, column }
    : undefined
}
