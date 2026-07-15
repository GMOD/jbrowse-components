/**
 * A region's genomic span paired with its on-screen pixel span. The base
 * geometry every backend works in: GPU clip math (`clipBlock`), Canvas2D clip
 * (`clipBlockForCanvas`), the bp→px mapper (`makeBpMapper`), and canvas
 * SVG/label/peptide positioning all consume this shape.
 */
export interface BpRegionBounds {
  start: number
  end: number
  screenStartPx: number
  screenEndPx: number
  reversed?: boolean
}

/**
 * A `BpRegionBounds` tagged with the `displayedRegionIndex` that joins it to
 * `rpcDataMap` / HAL buffers. `reversed` is resolved (always present) once a
 * block reaches the render path.
 */
export interface RenderBlock extends BpRegionBounds {
  displayedRegionIndex: number
  reversed: boolean
}

export function buildRenderBlocks(
  regions: (BpRegionBounds & { displayedRegionIndex: number })[],
): RenderBlock[] {
  return regions.map(r => ({
    displayedRegionIndex: r.displayedRegionIndex,
    start: r.start,
    end: r.end,
    screenStartPx: r.screenStartPx,
    screenEndPx: r.screenEndPx,
    reversed: r.reversed ?? false,
  }))
}
