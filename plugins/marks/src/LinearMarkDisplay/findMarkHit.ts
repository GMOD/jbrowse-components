import { bpAtPxExact } from '@jbrowse/render-core/canvas2dUtils'

import type { MarkShapeName } from './configSchema.ts'
import type {
  DisplayMark,
  MarkRegionData,
  MarkRenderState,
} from './markList.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

export interface MarkHitInfo {
  markIndex: number
  regionIndex: number
  instance: number
  refName: string
  start: number
  end: number
  /** The plotted value, or undefined for a mark with no `y`. */
  y: number | undefined
  /** The packed colour the worker resolved for this instance. */
  color: number
  screenX: number
  screenY: number
}

const HIT_RADIUS_PX = 8

// Inverse of the shape's `valueToYPx`, unclamped: canvas y (px from the top)
// to a value, for the score window a cursor position asks the index about.
export function yPxToValue(
  yPx: number,
  domain: [number, number],
  canvasHeight: number,
) {
  const [min, max] = domain
  return max - (yPx / canvasHeight) * (max - min || 1)
}

// The value window mark `shape` is asked about at cursor score `s`: a point's
// ink is at its value, a bar's reaches from the origin to it, a span's is
// everywhere. Widened to the canvas edges where the cursor is within reach of
// one, so a value clamped to the top or bottom stays catchable.
function valueWindow(
  shape: MarkShapeName,
  mouseY: number,
  state: MarkRenderState,
): [number, number] {
  const { domainY, canvasHeight, origin } = state
  if (shape === 'span') {
    return [-Infinity, Infinity]
  }
  const lo =
    mouseY >= canvasHeight - HIT_RADIUS_PX
      ? -Infinity
      : yPxToValue(mouseY + HIT_RADIUS_PX, domainY, canvasHeight)
  const hi =
    mouseY <= HIT_RADIUS_PX
      ? Infinity
      : yPxToValue(mouseY - HIT_RADIUS_PX, domainY, canvasHeight)
  if (shape === 'bar') {
    const s = yPxToValue(mouseY, domainY, canvasHeight)
    return s >= origin ? [lo, Infinity] : [-Infinity, hi]
  }
  return [lo, hi]
}

/**
 * The mark instance nearest the cursor, marks on top asked first: each
 * mark's own hit test runs over the candidates its layer's Flatbush answers,
 * and only a strictly nearer instance from a mark underneath replaces one from
 * a mark above.
 */
export function findMarkHit(
  mouseX: number,
  mouseY: number,
  blocks: RenderBlock[],
  regionData: ReadonlyMap<number, MarkRegionData>,
  marks: readonly DisplayMark[],
  shapes: readonly MarkShapeName[],
  state: MarkRenderState,
  refNames: ReadonlyMap<number, string>,
): MarkHitInfo | undefined {
  let bestDistSq = HIT_RADIUS_PX * HIT_RADIUS_PX
  let best: MarkHitInfo | undefined
  for (const block of blocks) {
    const regionIndex = block.displayedRegionIndex
    const data = regionData.get(regionIndex)
    const refName = refNames.get(regionIndex)
    const blockWidthPx = block.screenEndPx - block.screenStartPx
    if (!data || !refName || blockWidthPx <= 0) {
      continue
    }
    const bpPerPx = (block.end - block.start) / blockWidthPx
    const mouseBp = bpAtPxExact(mouseX, block)
    const halfBp = HIT_RADIUS_PX * bpPerPx
    const bpMin = mouseBp - halfBp
    const bpMax = mouseBp + halfBp
    if (bpMax < block.start || bpMin > block.end) {
      continue
    }
    for (let m = marks.length - 1; m >= 0; m--) {
      const layer = data.layers[m]
      const mark = marks[m]!
      const shape = shapes[m]!
      if (!layer?.flatbush || !mark.hitNearest) {
        continue
      }
      const [vMin, vMax] = valueWindow(shape, mouseY, state)
      const hit = mark.hitNearest(
        data,
        block,
        state,
        mouseX,
        mouseY,
        layer.flatbush.search(bpMin, vMin, bpMax, vMax),
        bestDistSq,
      )
      if (hit) {
        bestDistSq = hit.distSq
        best = {
          markIndex: m,
          regionIndex,
          instance: hit.index,
          refName,
          start: layer.x[hit.index]!,
          end: layer.x2[hit.index]!,
          y: shape === 'span' ? undefined : layer.y[hit.index]!,
          color: layer.color[hit.index]!,
          screenX: hit.x,
          screenY: hit.y,
        }
      }
    }
  }
  return best
}

export function sameMarkHit(a: MarkHitInfo, b: MarkHitInfo) {
  return (
    a.markIndex === b.markIndex &&
    a.regionIndex === b.regionIndex &&
    a.instance === b.instance
  )
}
