import {
  getTickDisplayStr,
  max,
  measureText,
  toLocale,
} from '@jbrowse/core/util'
import { bpToPx } from '@jbrowse/core/util/Base1DUtils'
import { chooseGridPitch } from '@jbrowse/core/util/chooseGridPitch'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import type { Dotplot1DViewModel } from '../model.ts'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

export interface Tick {
  type: 'major' | 'minor'
  base: number
  index: number
  refName: string
}

export interface PositionedTick {
  tick: Tick
  alongPx: number
}

export function locstr(
  px: number,
  view: Dotplot1DViewModel,
  includeAsm = true,
) {
  const { assemblyName, refName, start, offset, oob } = view.pxToBp(px)
  const coord = Math.floor(start + offset)
  return oob
    ? 'out of bounds'
    : `${includeAsm ? `{${assemblyName}}` : ''}${refName}:${toLocale(coord)}`
}

// Axis labels render at fontSize 11 (see Axes.tsx); measure at the same size so
// the reserved border width isn't a systematic ~10% underestimate.
function stringLenPx(a: string) {
  return measureText(a.slice(0, 30), 11)
}

// A region contributes two axis labels: its refName and the tick string at its
// end coordinate. The minimal shape needed for both (IRegion satisfies it).
interface LabelRegion {
  refName: string
  end: number
}

// Widest axis label in px across all regions — the longer of each region's
// refName or its end-coordinate tick string (bpPerPx sets the tick precision).
// Depends only on regions + zoom, never on the viewport width, so the border it
// sizes can't feed back into itself (viewWidth = width - border).
export function axisLabelWidthPx(regions: LabelRegion[], bpPerPx: number) {
  return max(
    regions.flatMap(r => [
      stringLenPx(r.refName),
      stringLenPx(getTickDisplayStr(r.end, bpPerPx)),
    ]),
    0,
  )
}

// Maps each tick's (refName, base) to an `alongPx` offset within the view —
// negative or out-of-range positions are kept so the caller can clip in one
// place. Shared between HorizontalAxis and VerticalAxis to keep their tick
// math identical.
export function computeTickPositions(
  view: Dotplot1DViewModel,
  ticks: Tick[],
): PositionedTick[] {
  const snap = {
    ...getSnapshot(view),
    width: view.width,
    staticBlocks: view.staticBlocks,
  }
  const offsetPx = view.offsetPx
  return ticks.flatMap(tick => {
    const px = bpToPx({
      refName: tick.refName,
      coord: tick.base,
      self: snap,
    })?.offsetPx
    return px === undefined ? [] : [{ tick, alongPx: px - offsetPx }]
  })
}

// Approximate px footprint of a block label along its axis. Two labels closer
// than this collide.
const LABEL_PX = 12

interface Interval {
  start: number
  end: number
}

function intervalsOverlap(a: Interval, b: Interval) {
  return Math.max(a.start, b.start) < Math.min(a.end, b.end)
}

// Greedily decide which block labels to drop so the kept ones don't overlap.
// Largest blocks win their slot first; each kept label reserves the LABEL_PX
// interval ending at its on-axis position, and any later label whose interval
// intersects a reserved one is hidden.
export function getBlockLabelKeysToHide(
  blocks: ContentBlock[],
  length: number,
  viewOffsetPx: number,
) {
  const hide = new Set<string>()
  const reserved: Interval[] = []
  const byLengthDesc = [...blocks].sort(
    (a, b) => b.end - b.start - (a.end - a.start),
  )
  for (const { key, offsetPx } of byLengthDesc) {
    const end = Math.round(length - offsetPx + viewOffsetPx)
    const label = { start: Math.max(end - LABEL_PX, 0), end }
    if (end === 0 || reserved.some(r => intervalsOverlap(label, r))) {
      hide.add(key)
    } else {
      reserved.push(label)
    }
  }
  return hide
}

// makeTicks stores `base` as (true base − 1); re-add the 1 here so the single
// off-by-one round-trip lives in one place shared by both axes.
export function tickLabel(tick: Tick, bpPerPx: number) {
  return getTickDisplayStr(tick.base + 1, bpPerPx)
}

export function makeTicks(
  regions: ContentBlock[],
  bpPerPx: number,
  emitMajor = true,
  emitMinor = true,
) {
  const ticks: Tick[] = []
  const gridPitch = chooseGridPitch(bpPerPx, 60, 15)
  const iterPitch = gridPitch.minorPitch || gridPitch.majorPitch
  for (const { start, end, refName } of regions) {
    let index = 0

    const minBase = start
    const maxBase = end

    for (
      let base = Math.floor(minBase / iterPitch) * iterPitch;
      base < Math.ceil(maxBase / iterPitch) * iterPitch + 1;
      base += iterPitch
    ) {
      if (emitMinor && base % gridPitch.majorPitch) {
        ticks.push({ type: 'minor', base: base - 1, index, refName })
        index += 1
      } else if (emitMajor && Math.abs(base - start) > gridPitch.minorPitch) {
        ticks.push({ type: 'major', base: base - 1, index, refName })
        index += 1
      }
    }
  }
  return ticks
}
