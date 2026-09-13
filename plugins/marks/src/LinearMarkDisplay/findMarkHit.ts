import {
  nearestMarkHit,
  pointInsetPx,
  valueWindow,
} from '@jbrowse/render-core/marks'

import { markValueScale } from './markList.ts'

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
  /** The packed colour the worker resolved for this instance, if its shape reads one. */
  color: number | undefined
  /** The raw value of a ramp colour channel, where the display resolves it. */
  colorValue: number | undefined
  screenX: number
  screenY: number
}

const HIT_RADIUS_PX = 8

// The value window mark `i`'s index is asked with, through the scale and the
// anchor its params lens hands its shape; a span's ink is at every value.
function markValueWindow(
  shape: MarkShapeName,
  i: number,
  mouseY: number,
  state: MarkRenderState,
): [number, number] {
  if (shape === 'span') {
    return [-Infinity, Infinity]
  }
  return valueWindow(mouseY, HIT_RADIUS_PX, state.canvasHeight, {
    ...markValueScale(state, i),
    ...(shape === 'bar'
      ? { origin: state.origin }
      : { insetPx: pointInsetPx(state.pointDiameterPx) }),
  })
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
  const hit = nearestMarkHit(
    marks,
    blocks,
    index => (refNames.has(index) ? regionData.get(index) : undefined),
    state,
    mouseX,
    mouseY,
    {
      radiusPx: HIT_RADIUS_PX,
      candidates: (data, m, { bpMin, bpMax }) => {
        const flatbush = data.layers[m]?.flatbush
        if (!flatbush) {
          return undefined
        }
        const [vMin, vMax] = markValueWindow(shapes[m]!, m, mouseY, state)
        return flatbush.search(bpMin, vMin, bpMax, vMax)
      },
    },
  )
  if (!hit) {
    return undefined
  }
  const layer = hit.region.layers[hit.mark]!
  const regionIndex = hit.block.displayedRegionIndex
  return {
    markIndex: hit.mark,
    regionIndex,
    instance: hit.index,
    refName: refNames.get(regionIndex)!,
    start: layer.x[hit.index]!,
    end: layer.x2[hit.index]!,
    y: layer.y?.[hit.index],
    color: layer.color?.[hit.index],
    colorValue: layer.colorValue?.[hit.index],
    screenX: hit.x,
    screenY: hit.y,
  }
}

export function sameMarkHit(a: MarkHitInfo, b: MarkHitInfo) {
  return (
    a.markIndex === b.markIndex &&
    a.regionIndex === b.regionIndex &&
    a.instance === b.instance
  )
}
