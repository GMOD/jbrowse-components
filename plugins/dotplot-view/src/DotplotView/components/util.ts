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

// One source of truth for the axis label/tick font, imported by both the
// renderer (Axes.tsx) and the border sizing here so the reserved width can
// never drift from what's actually drawn.
export const AXIS_LABEL_FONT = 10

// Cap the *displayed* refName so one long scaffold name can't blow up the axis
// margin. Only refNames are capped (tick coordinates stay exact); the full name
// is still shown on hover. Middle-elided to keep both a numbered scaffold's
// prefix and its distinguishing suffix (scaffold_1234 -> scaf…1234).
const LABEL_SIDE_CHARS = 4
export function truncateRefName(refName: string) {
  return refName.length > LABEL_SIDE_CHARS * 2 + 1
    ? `${refName.slice(0, LABEL_SIDE_CHARS)}…${refName.slice(-LABEL_SIDE_CHARS)}`
    : refName
}

// Fixed px an axis needs beyond its widest label: the 7px tick-label inset
// (labels anchor at border - 7) plus the rotated assembly title parked at x=12.
// The floor keeps room for that title on a short-label axis (e.g. self-vs-self
// "ctgA").
const BORDER_CHROME = 25
const MIN_BORDER = 50

// Approximate px footprint of a block label along its axis. Two labels closer
// than this collide, so a region spanning fewer than this many px can't own an
// uncrowded label slot — the greedy hider (getBlockLabelKeysToHide) drops it.
const LABEL_PX = 12

// Axis margin px, sized to the widest label — the longer of each region's
// (truncated) refName or its exact end-coordinate tick. Only regions at least
// LABEL_PX tall on screen count: smaller ones (unplaced *_random contigs at
// whole-genome zoom) are collision-hidden and must not inflate the margin. A
// contig you zoom into grows past LABEL_PX and reclaims its space. Depends only
// on regions + zoom, never viewport width, so it stays acyclic (viewWidth =
// width - border).
export function axisBorderPx(
  regions: { refName: string; start: number; end: number }[],
  bpPerPx: number,
) {
  const labelWidth = max(
    regions.flatMap(r =>
      (r.end - r.start) / bpPerPx >= LABEL_PX
        ? [
            measureText(truncateRefName(r.refName), AXIS_LABEL_FONT),
            measureText(getTickDisplayStr(r.end, bpPerPx), AXIS_LABEL_FONT),
          ]
        : [],
    ),
    0,
  )
  return Math.max(labelWidth + BORDER_CHROME, MIN_BORDER)
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
