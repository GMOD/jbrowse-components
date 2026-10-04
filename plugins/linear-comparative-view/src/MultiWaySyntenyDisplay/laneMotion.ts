import { MORPH_DURATION_MS, clamp, easeInOutCubic } from '@jbrowse/core/util'

import { frameOpenings, laneBpOfOpened, rowFrameX } from './layoutMultiWay.ts'

import type { LaneDecision } from './laneDecision.ts'
import type { RowFrame } from './layoutMultiWay.ts'
import type { LaneMap } from './multiwayRenderTypes.ts'

export interface LaneTransition {
  from: readonly { decision: LaneDecision; weight: number }[]
  startMs: number
}

type WeightedFrames = readonly { frame: RowFrame; weight: number }[]

// a flip passes through zero, and a zero scale is a NaN pan
const MIN_SCALE = 1e-4
// so repeated interruptions cannot grow the mix without bound
const MIN_WEIGHT = 1e-3
// at this scale a glyph's first frame lands up to 2.5 px off the old picture
const MAX_START_SCALE = 4

export function laneMotionEnd(t: LaneTransition) {
  return t.startMs + MORPH_DURATION_MS
}

export function laneMotionEase(t: LaneTransition, nowMs: number) {
  return easeInOutCubic(clamp((nowMs - t.startMs) / MORPH_DURATION_MS, 0, 1))
}

// about a bp near the frames, so no genome-scale magnitude multiplies through
function lineOf(frame: RowFrame, ref: number, width: number) {
  return {
    slope: ((frame.flipped ? -1 : 1) * width) / (frame.max - frame.min),
    at: rowFrameX(frame, ref, width),
  }
}

function drawnLine(
  from: WeightedFrames,
  to: RowFrame,
  e: number,
  width: number,
) {
  const ref = laneBpOfOpened(frameOpenings(to), to.min)
  const target = lineOf(to, ref, width)
  let slope = e * target.slope
  let at = e * target.at
  for (const { frame, weight } of from) {
    const line = lineOf(frame, ref, width)
    slope += (1 - e) * weight * line.slope
    at += (1 - e) * weight * line.at
  }
  return { slope, at, target }
}

/** Maps `to`'s packed px to where the lane draws: the old picture at `e` 0. */
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

function canMove(from: WeightedFrames, to: RowFrame, width: number) {
  const { slope, at } = drawnLine(from, to, 0, width)
  const { scale, offset } = laneMapAt(from, to, 0, width)
  if (
    Math.max(Math.abs(offset), Math.abs((scale - 1) * width + offset)) < 0.5 ||
    Math.abs(scale) > MAX_START_SCALE
  ) {
    return false
  }
  if (Math.abs(slope) < Number.EPSILON) {
    return at >= 0 && at <= width
  }
  const a = to.min + (0 - at) / slope
  const b = to.min + (width - at) / slope
  return Math.max(a, b) > to.min && Math.min(a, b) < to.max
}

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

/** Only a lane re-decided onto the same contig moves; every other snaps. */
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
  /** the clock the last drawn frame read */
  drawnAtMs: number
  nowMs: number
  allowed: boolean
  frameOf: (decision: LaneDecision, lane: string) => RowFrame | undefined
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
      const to = frameOf(decision, lane)
      const frames = from.flatMap(seed => {
        const frame = frameOf(seed.decision, lane)
        return frame ? [{ frame, weight: seed.weight }] : []
      })
      if (to && frames.length === from.length && canMove(frames, to, width)) {
        out.set(lane, { from, startMs: nowMs })
      }
    }
  }
  return out
}

export function lanesPastHalfway(
  running: ReadonlyMap<string, LaneTransition>,
  nowMs: number,
) {
  return new Set(
    [...running]
      .filter(([, t]) => nowMs >= t.startMs + MORPH_DURATION_MS / 2)
      .map(([lane]) => lane),
  )
}

/** where the lane drew, until halfway */
export function shownFrame(frame: RowFrame, pastHalfway: boolean) {
  const from = frame.morphFrom
  return from?.length && !pastHalfway
    ? from.reduce((a, b) => (b.weight > a.weight ? b : a)).frame
    : frame
}

export function laneTransitionsRunning(
  running: ReadonlyMap<string, LaneTransition>,
  nowMs: number,
) {
  return new Map([...running].filter(([, t]) => laneMotionEnd(t) > nowMs))
}
