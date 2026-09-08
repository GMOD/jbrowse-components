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

/**
 * One display key's whole canvas as a single block.
 *
 * For a display whose x axis is not the block's bp span — a dotplot segment, a
 * synteny ribbon, a Hi-C or LD diamond all read their screen x off the
 * payload's own coordinates through a `panPx` fold the shader and the painter
 * each apply — so the block carries nothing but its key and the identity bp
 * span that keeps `clipBlock` well-formed.
 */
export function canvasWideBlock(
  displayedRegionIndex: number,
  canvasWidth: number,
): RenderBlock {
  return {
    displayedRegionIndex,
    start: 0,
    end: canvasWidth,
    screenStartPx: 0,
    screenEndPx: canvasWidth,
    reversed: false,
  }
}

/** {@link canvasWideBlock} per key, in the keys' own order. */
export function canvasWideBlocks(
  keys: Iterable<number>,
  canvasWidth: number,
): RenderBlock[] {
  return [...keys].map(key => canvasWideBlock(key, canvasWidth))
}
