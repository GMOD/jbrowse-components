import { assembleLocString } from '@jbrowse/core/util'
import { colorAt, featureIndexAt } from '@jbrowse/core/util/markEncoding'
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
import type { HitWindow, RowSpanIndex } from '@jbrowse/render-core/marks'
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
  /**
   * The sequence `end` lies on, where a link's far foot is on another one
   * than `refName`.
   */
  x2RefName?: string
  /** The base under the cursor, inside the instance's span. */
  bp: number
  /** The plotted value, or undefined for a mark with no `y`. */
  y: number | undefined
  /** The packed colour the worker resolved for this instance, if its mark reads one. */
  color: number | undefined
  /** The raw value of a ramp colour channel, where the display resolves it. */
  colorValue: number | undefined
  /**
   * Whether the instance's region still holds an earlier `color`
   * declaration's data (`HeldColor`), whose colour no key names.
   */
  heldColor?: boolean
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

// The sequence a link's far foot lies on: the displayed region it draws to,
// else the name the file gives it; undefined for a mark whose `x2` is its own.
function farRefNameOf(
  layer: StoredLayer,
  i: number,
  displayedRegions: readonly { refName: string }[],
) {
  const region = layer.x2Region?.[i]
  const shown = region === undefined ? undefined : displayedRegions[region]
  const ref = layer.x2Ref?.[i]
  return (
    shown?.refName ?? (ref === undefined ? undefined : layer.x2RefNames?.[ref])
  )
}

/**
 * The hovered instance's locus: its span, or a link's two feet where the far
 * one lies on another sequence.
 */
export function hitLocString({ refName, start, end, x2RefName }: MarkHitInfo) {
  return x2RefName === undefined || x2RefName === refName
    ? assembleLocString({
        refName,
        start: Math.min(start, end),
        end: Math.max(start, end),
      })
    : `${assembleLocString({ refName, start, end: start + 1 })} → ${assembleLocString({ refName: x2RefName, start: end, end: end + 1 })}`
}

const rowIndexes = new WeakMap<StoredLayer, RowSpanIndex>()

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

// What a Flatbush over every instance's (x..x2, y) answers for the window,
// less the rows out of reach; the reach widens by the mark's size, the most a
// rule or line's stroke stands past its band.
function rowCandidates(
  layer: StoredLayer,
  yPx: number,
  state: MarkRenderState,
  sizePx: number,
  { bpMin, bpMax, valueMin, valueMax }: HitWindow,
) {
  const index = rowIndexOf(layer)
  const out: number[] = []
  for (const key of rowKeysNear(yPx, state, HIT_RADIUS_PX + sizePx)) {
    spansInRow(index, layer.x, layer.x2, key, bpMin, bpMax, out)
  }
  const { y } = layer
  return y ? out.filter(i => y[i]! >= valueMin && y[i]! <= valueMax) : out
}

const drawnLastFirst = (a: number, b: number) => b - a

/**
 * The mark instance nearest the cursor, marks on top asked first: each
 * mark's own hit test runs over the candidates its layer answers — a bar,
 * line, rule or span's from the rows near the cursor, a point or link's from
 * the Flatbush the worker built — and only a strictly nearer instance from a
 * mark underneath replaces one from a mark above. Candidates go back to
 * front, so of two equally near the one drawn over the other answers.
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
      regionKeys: regionData.keys(),
      candidates: (data, m, reach) => {
        const mark = marks[m]!
        const layer = data.layers[mark.markIndex]
        if (!layer) {
          return undefined
        }
        const { bpMin, bpMax, valueMin, valueMax } = reach
        const found =
          mark.hitBy === 'rows'
            ? rowCandidates(
                layer,
                mouseY,
                state,
                state.markSizes[mark.markIndex] ?? 0,
                reach,
              )
            : layer.flatbush?.search(bpMin, valueMin, bpMax, valueMax)
        return found?.sort(drawnLastFirst)
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
  const { refName } = displayedRegions[regionIndex]!
  const farRefName = farRefNameOf(layer, hit.index, displayedRegions)
  const x2RefName = farRefName === refName ? undefined : farRefName
  const lo = Math.min(start, end)
  const hi = Math.max(start, end)
  return {
    markIndex,
    regionIndex,
    instance: hit.index,
    featureIndex: featureIndexAt(layer, hit.index),
    refName,
    start,
    end,
    ...(x2RefName === undefined ? {} : { x2RefName }),
    bp:
      spansView || x2RefName !== undefined
        ? start
        : clamp(bpAtPx(mouseX, hit.block), lo, Math.max(lo, hi - 1)),
    y: layer.y?.[hit.index],
    color: colorAt(layer, hit.index),
    colorValue: layer.colorValue?.[hit.index],
    heldColor: layer.heldColor,
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
