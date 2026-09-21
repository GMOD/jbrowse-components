import { MORPH_DURATION_MS, clamp, easeInOutCubic } from '@jbrowse/core/util'

import { rowFrameX } from './layoutMultiWay.ts'

import type { LaneDecision } from './laneDecision.ts'
import type { RowFrame } from './layoutMultiWay.ts'
import type { LaneMap } from './multiwayRenderTypes.ts'

/**
 * A mate lane moving from where it drew to its settled decision, timed on the
 * wall clock from `startMs`. `from` is where it drew when the settle landed:
 * one decision, or, when a second settle interrupts a first, the mix of
 * decisions it was drawn between at that moment.
 */
export interface LaneTransition {
  from: readonly { decision: LaneDecision; weight: number }[]
  startMs: number
}

type WeightedFrames = readonly { frame: RowFrame; weight: number }[]

// a flip passes through zero, and a zero scale is a NaN pan in the ribbons'
// transform
const MIN_SCALE = 1e-4
// a mix entry whose share rounds to nothing is dropped, so repeated
// interruptions cannot grow the mix without bound
const MIN_WEIGHT = 1e-3
// The new frame packs the lane at whole px, and a move that starts magnified
// magnifies that rounding: at this scale a glyph's first frame lands up to
// 2.5 px off the old picture. The ladder's own steps are at most 2x, so what
// snaps is a leap of several rungs at once
const MAX_START_SCALE = 4

export function laneMotionEnd(t: LaneTransition) {
  return t.startMs + MORPH_DURATION_MS
}

export function laneMotionEase(t: LaneTransition, nowMs: number) {
  return easeInOutCubic(clamp((nowMs - t.startMs) / MORPH_DURATION_MS, 0, 1))
}

// A frame's px as `slope * (bp - ref) + at`, stated about a bp near the frames
// so no genome-scale magnitude is multiplied through.
function lineOf(frame: RowFrame, ref: number, width: number) {
  return {
    slope: ((frame.flipped ? -1 : 1) * width) / (frame.max - frame.min),
    at: rowFrameX(frame, ref, width),
  }
}

// where the lane draws each bp `e` of the way from `from` to `to`: every bp
// travels in a straight line between its two positions
function drawnLine(
  from: WeightedFrames,
  to: RowFrame,
  e: number,
  width: number,
) {
  const target = lineOf(to, to.min, width)
  let slope = e * target.slope
  let at = e * target.at
  for (const { frame, weight } of from) {
    const line = lineOf(frame, to.min, width)
    slope += (1 - e) * weight * line.slope
    at += (1 - e) * weight * line.at
  }
  return { slope, at, target }
}

/**
 * The map from the px `to` packs a lane in to where it draws `e` of the way
 * from `from`: the old frame's picture at 0 and identity at 1. The scale is
 * held off zero about the canvas centre.
 */
export function laneMapAt(
  from: WeightedFrames,
  to: RowFrame,
  e: number,
  width: number,
): LaneMap {
  const { slope, at, target } = drawnLine(from, to, e, width)
  const exact = slope / target.slope
  const scale =
    Math.abs(exact) >= MIN_SCALE ? exact : exact < 0 ? -MIN_SCALE : MIN_SCALE
  return {
    scale,
    offset: at - exact * target.at + ((exact - scale) * width) / 2,
  }
}

// Whether the bp the lane draws on screen at the settle overlap what the new
// frame shows, and the move starts no more magnified than the packing can
// bear. A jump to somewhere else entirely is a relocation, and a smear across
// it says nothing.
function canMove(from: WeightedFrames, to: RowFrame, width: number) {
  const { slope, at, target } = drawnLine(from, to, 0, width)
  if (Math.abs(slope / target.slope) > MAX_START_SCALE) {
    return false
  }
  if (Math.abs(slope) < Number.EPSILON) {
    return at >= 0 && at <= width
  }
  const a = to.min + (0 - at) / slope
  const b = to.min + (width - at) / slope
  return Math.max(a, b) > to.min && Math.min(a, b) < to.max
}

// the decisions a lane is drawn between `e` of the way through `running`, and
// then `current`, which it was heading for
function drawnMix(
  running: LaneTransition | undefined,
  current: LaneDecision,
  e: number,
) {
  const mix = new Map<LaneDecision, number>([[current, running ? e : 1]])
  if (running) {
    for (const { decision, weight } of running.from) {
      mix.set(decision, (mix.get(decision) ?? 0) + weight * (1 - e))
    }
  }
  const kept = [...mix].filter(([, weight]) => weight >= MIN_WEIGHT)
  const total = kept.reduce((sum, [, weight]) => sum + weight, 0)
  return kept.map(([decision, weight]) => ({
    decision,
    weight: weight / total,
  }))
}

/**
 * The transitions a settle leaves running. A lane whose decision is the one it
 * already had keeps whatever it was doing; a lane re-decided onto the SAME
 * contig starts moving from where it draws now, mid-flight included; every
 * other lane snaps — a contig change, a first decision, a lane with no
 * decision, a jump whose two pictures share nothing on screen, a leap of
 * several rungs at once, and every lane when motion is not allowed.
 */
export function laneTransitionsAfter({
  previous,
  next,
  running,
  drawnAtMs,
  nowMs,
  allowed,
  frameOf,
  width,
}: {
  previous: ReadonlyMap<string, LaneDecision | undefined>
  next: ReadonlyMap<string, LaneDecision | undefined>
  running: ReadonlyMap<string, LaneTransition>
  /** the clock the last drawn frame read, which is where an interrupted lane is */
  drawnAtMs: number
  nowMs: number
  allowed: boolean
  frameOf: (decision: LaneDecision) => RowFrame | undefined
  width: number
}) {
  const out = new Map<string, LaneTransition>()
  for (const [lane, decision] of allowed ? next : []) {
    const prior = previous.get(lane)
    const held = running.get(lane)
    if (decision === prior) {
      if (held) {
        out.set(lane, held)
      }
    } else if (decision && prior && decision.refName === prior.refName) {
      const from = drawnMix(
        held,
        prior,
        held ? laneMotionEase(held, drawnAtMs) : 1,
      )
      const to = frameOf(decision)
      const frames = from.flatMap(seed => {
        const frame = frameOf(seed.decision)
        return frame ? [{ frame, weight: seed.weight }] : []
      })
      if (to && frames.length === from.length && canMove(frames, to, width)) {
        out.set(lane, { from, startMs: nowMs })
      }
    }
  }
  return out
}

/** the running transitions whose end the clock has not reached */
export function laneTransitionsRunning(
  running: ReadonlyMap<string, LaneTransition>,
  nowMs: number,
) {
  return new Map([...running].filter(([, t]) => laneMotionEnd(t) > nowMs))
}
