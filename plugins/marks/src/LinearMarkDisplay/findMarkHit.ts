import { nearestMarkHit } from '@jbrowse/render-core/marks'

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
  /** The glyph code the worker resolved, if its shape reads one. */
  glyph: number | undefined
  /** The band this instance stands in, if its shape reads a row. */
  row: number | undefined
  screenX: number
  screenY: number
}

const HIT_RADIUS_PX = 8

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
  state: MarkRenderState,
  displayedRegions: readonly { refName: string }[],
): MarkHitInfo | undefined {
  const hit = nearestMarkHit(
    marks,
    blocks,
    index => regionData.get(index),
    state,
    mouseX,
    mouseY,
    {
      radiusPx: HIT_RADIUS_PX,
      candidates: (data, m, { bpMin, bpMax, valueMin, valueMax }) =>
        data.layers[m]?.flatbush?.search(bpMin, valueMin, bpMax, valueMax),
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
    refName: displayedRegions[regionIndex]!.refName,
    start: layer.x[hit.index]!,
    end: layer.x2[hit.index]!,
    y: layer.y?.[hit.index],
    color: layer.color?.[hit.index],
    colorValue: layer.colorValue?.[hit.index],
    glyph: layer.glyph?.[hit.index],
    row: layer.row?.[hit.index],
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
