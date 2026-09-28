import { clamp } from '@jbrowse/core/util/numericUtils'
import { bpAtPx } from '@jbrowse/render-core/canvas2dUtils'
import {
  HIDDEN_ROW,
  nearestMarkHit,
  rowSpanIndex,
  spansInRow,
} from '@jbrowse/render-core/marks'

import type {
  DisplayMark,
  MarkRegionData,
  MarkRenderState,
  StoredLayer,
} from './markList.ts'
import type { RowSpanIndex } from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

export interface MarkHitInfo {
  markIndex: number
  regionIndex: number
  instance: number
  /** Which feature of the layer's list the worker encoded this instance from. */
  featureIndex: number
  refName: string
  start: number
  end: number
  /** The base under the cursor, inside the instance's span. */
  bp: number
  /** The plotted value, or undefined for a mark with no `y`. */
  y: number | undefined
  /** The packed colour the worker resolved for this instance, if its mark reads one. */
  color: number | undefined
  /** The raw value of a ramp colour channel, where the display resolves it. */
  colorValue: number | undefined
  /** The point painter's code for the instance's shape, if its mark reads one. */
  glyph: number | undefined
  /**
   * The `row` this instance carries, if its mark reads one: its band, or
   * under `rows` its key, which the row table places.
   */
  row: number | undefined
  screenX: number
  screenY: number
}

const HIT_RADIUS_PX = 8

const rowIndexes = new WeakMap<StoredLayer, RowSpanIndex>()

// A span layer's spans by row, built the first time a hover asks it: a span
// only ever stands in its own row, so no index over every span is needed.
function rowIndexOf(layer: StoredLayer) {
  let index = rowIndexes.get(layer)
  if (!index) {
    index = rowSpanIndex(layer.x, layer.x2, layer.row, layer.count)
    rowIndexes.set(layer, index)
  }
  return index
}

// The `row` keys whose bands lie within the hit radius of `yPx`: the slots
// the radius reaches, read back through the row table where one binds keys to
// slots.
function rowKeysNear(yPx: number, state: MarkRenderState, radiusPx: number) {
  const { rowHeight, scrollTop, rowTable } = state
  const first = Math.max(
    0,
    Math.floor((yPx - radiusPx + scrollTop) / rowHeight) - 1,
  )
  const last = Math.floor((yPx + radiusPx + scrollTop) / rowHeight) + 1
  if (!rowTable) {
    return Array.from({ length: last - first + 1 }, (_, k) => first + k)
  }
  const keys: number[] = []
  for (let key = 0; key < rowTable.keys; key++) {
    const slot = rowTable.slot[key]!
    if (slot !== HIDDEN_ROW && slot >= first && slot <= last) {
      keys.push(key)
    }
  }
  return keys
}

/**
 * The mark instance nearest the cursor, marks on top asked first: each
 * mark's own hit test runs over the candidates its layer answers — a span's
 * from the rows near the cursor, any other's from the Flatbush the worker
 * built — and only a strictly nearer instance from a mark underneath replaces
 * one from a mark above.
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
  let nearRows: number[] | undefined
  const hit = nearestMarkHit(
    marks,
    blocks,
    index => regionData.get(index),
    state,
    mouseX,
    mouseY,
    {
      radiusPx: HIT_RADIUS_PX,
      regionKeys: regionData.keys(),
      candidates: (data, m, { bpMin, bpMax, valueMin, valueMax }) => {
        const mark = marks[m]!
        const layer = data.layers[mark.markIndex]
        if (!layer) {
          return undefined
        }
        if (mark.hitBy === 'rows') {
          const index = rowIndexOf(layer)
          nearRows ??= rowKeysNear(mouseY, state, HIT_RADIUS_PX)
          const out: number[] = []
          for (const key of nearRows) {
            spansInRow(index, layer.x, layer.x2, key, bpMin, bpMax, out)
          }
          return out
        }
        return layer.flatbush?.search(bpMin, valueMin, bpMax, valueMax)
      },
    },
  )
  if (!hit) {
    return undefined
  }
  const { markIndex, spansView } = marks[hit.mark]!
  const layer = hit.region.layers[markIndex]!
  const regionIndex = hit.block.displayedRegionIndex
  const start = layer.x[hit.index]!
  const end = layer.x2[hit.index]!
  return {
    markIndex,
    regionIndex,
    instance: hit.index,
    featureIndex: layer.featureIndex[hit.index]!,
    refName: displayedRegions[regionIndex]!.refName,
    start,
    end,
    bp: spansView
      ? start
      : clamp(bpAtPx(mouseX, hit.block), start, Math.max(start, end - 1)),
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
