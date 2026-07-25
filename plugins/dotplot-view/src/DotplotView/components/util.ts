import {
  getTickDisplayStr,
  max,
  measureText,
  toLocale,
} from '@jbrowse/core/util'
import { chooseGridPitch } from '@jbrowse/core/util/chooseGridPitch'

import type { Dotplot1DViewModel } from '../model.ts'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

export interface Tick {
  type: 'major' | 'minor'
  base: number
  refName: string
}

export interface PositionedTick {
  tick: Tick
  alongPx: number
}

export function locstr(px: number, view: Dotplot1DViewModel) {
  const { assemblyName, refName, start, offset, oob } = view.pxToBp(px)
  const coord = Math.floor(start + offset)
  return oob
    ? 'out of bounds'
    : `{${assemblyName}}${refName}:${toLocale(coord)}`
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
  const { offsetPx } = view
  return ticks.flatMap(tick => {
    const px = view.bpToPx({ refName: tick.refName, coord: tick.base })
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
//
// `length - offsetPx + viewOffsetPx` is the vertical axis's own label position
// (it lays out bottom-up, so this is literally `yoff` in Axes.tsx). The
// horizontal axis passes the same expression, which is the MIRROR of where it
// draws its labels (`b.offsetPx - offsetPx`). That is deliberate and safe for
// the overlap test — mirroring is an isometry, so which pairs collide is
// unchanged — but it does mean the two boundary rules below (the `end === 0`
// force-hide and the clamp at 0) land on the right edge for the horizontal axis
// and the top edge for the vertical one. Both are the edge where that axis's
// text would render outside the SVG, so don't "fix" the asymmetry by making it
// symmetric: that hides labels which currently render fine at the opposite edge.
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

// Ticks for one axis, built from staticBlocks so the count stays bounded by the
// viewport rather than by chromosome length.
//
// Two things follow from the blocks being static (1000px-aligned, several per
// region) rather than one block per region:
//
// - the pitch-aligned loop bounds overshoot each block's end and the next block
//   restarts below its own start, so the shared seam emits its ticks twice
//   unless deduped. Doubled <line>s stroke visibly darker than their neighbors
//   and the SVG export carries both copies.
// - a block's `start` is an arbitrary 1000px boundary, so it can't stand in for
//   the region start. The major tick that would collide with the refName label
//   is therefore suppressed only on the block at the region's own left end
//   (`isLeftEndOfDisplayedRegion`), measured from the edge the label is drawn
//   at — `end` for a reversed region, which lays out right-to-left.
export function makeTicks(regions: ContentBlock[], bpPerPx: number) {
  const ticks: Tick[] = []
  const seen = new Set<string>()
  const gridPitch = chooseGridPitch(bpPerPx, 60, 15)
  const iterPitch = gridPitch.minorPitch || gridPitch.majorPitch
  for (const block of regions) {
    const { start, end, refName } = block
    const labelBase = block.reversed ? end : start
    for (
      let base = Math.floor(start / iterPitch) * iterPitch;
      base < Math.ceil(end / iterPitch) * iterPitch + 1;
      base += iterPitch
    ) {
      const key = `${refName}-${base}`
      if (!seen.has(key)) {
        seen.add(key)
        const major = base % gridPitch.majorPitch === 0
        const underLabel =
          !!block.isLeftEndOfDisplayedRegion &&
          Math.abs(base - labelBase) <= gridPitch.minorPitch
        if (!major || !underLabel) {
          ticks.push({
            type: major ? 'major' : 'minor',
            base: base - 1,
            refName,
          })
        }
      }
    }
  }
  return ticks
}
