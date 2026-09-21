import { MORPH_DURATION_MS } from '@jbrowse/core/util'

import { frameFromDecision } from './laneDecision.ts'
import {
  laneMapAt,
  laneMotionEase,
  laneTransitionsAfter,
} from './laneMotion.ts'
import { rowFrameX } from './layoutMultiWay.ts'
import { drawnPx } from './multiwayRenderTypes.ts'

import type { LaneDecision } from './laneDecision.ts'
import type { LaneTransition } from './laneMotion.ts'
import type { RowFrame } from './layoutMultiWay.ts'

const W = 800
const UNIT = 10_000
const PIVOT_PX = 300

function decision(over: Partial<LaneDecision> = {}): LaneDecision {
  return {
    refName: 'chr2',
    flipped: false,
    rung: 1,
    pivotAnchor: { refName: 'chr1', coord: 5000 },
    pivotLaneBp: 1_000_000,
    fitMin: 995_000,
    fitMax: 1_005_000,
    alsoOn: [],
    alsoOnMore: 0,
    pinned: false,
    orientationPinned: false,
    ...over,
  }
}

const frameOf = (d: LaneDecision) => frameFromDecision(d, PIVOT_PX, UNIT, W)

const SAMPLES = [996_500, 999_000, 1_000_000, 1_002_000, 1_004_900]

// where the transition draws each sample bp, `e` of the way from `from` to `to`
function drawnAt(from: RowFrame, to: RowFrame, e: number) {
  const map = laneMapAt([{ frame: from, weight: 1 }], to, e, W)
  return SAMPLES.map(bp => drawnPx(map, rowFrameX(to, bp, W)))
}

describe.each([
  ['a broken hold re-aligning', decision({ pivotLaneBp: 1_003_000 })],
  ['a rung change', decision({ rung: 3 })],
  ['a flip', decision({ flipped: true })],
])('%s', (_name, next) => {
  const from = frameOf(decision())
  const to = frameOf(next)

  test('draws every bp where the old frame did at the start', () => {
    const expected = SAMPLES.map(bp => rowFrameX(from, bp, W))
    drawnAt(from, to, 0).forEach((x, i) => {
      expect(x).toBeCloseTo(expected[i]!, 6)
    })
  })

  test('is the identity once it lands', () => {
    const map = laneMapAt([{ frame: from, weight: 1 }], to, 1, W)
    expect(map.scale).toBeCloseTo(1, 12)
    expect(map.offset).toBeCloseTo(0, 6)
  })

  test('moves each bp in a straight line between its two positions', () => {
    drawnAt(from, to, 0.25).forEach((x, i) => {
      const bp = SAMPLES[i]!
      expect(x).toBeCloseTo(
        0.75 * rowFrameX(from, bp, W) + 0.25 * rowFrameX(to, bp, W),
        6,
      )
    })
  })
})

test('a flip folds through a scale held off zero rather than a NaN pan', () => {
  const from = frameOf(decision())
  const to = frameOf(decision({ flipped: true }))
  const map = laneMapAt([{ frame: from, weight: 1 }], to, 0.5, W)
  expect(map.scale).not.toBe(0)
  expect(Number.isFinite(1 / map.scale)).toBe(true)
  expect(Number.isFinite(map.offset)).toBe(true)
})

function transitionsAfter(
  previous: LaneDecision | undefined,
  next: LaneDecision | undefined,
  over: Partial<Parameters<typeof laneTransitionsAfter>[0]> = {},
) {
  return laneTransitionsAfter({
    previous: new Map([['lane', previous]]),
    next: new Map([['lane', next]]),
    running: new Map(),
    drawnAtMs: 0,
    nowMs: 1000,
    allowed: true,
    frameOf,
    width: W,
    ...over,
  })
}

test('a same-contig re-decision starts a transition from where the lane drew', () => {
  const prior = decision()
  const t = transitionsAfter(prior, decision({ pivotLaneBp: 1_003_000 }))
  expect(t.get('lane')).toEqual({
    from: [{ decision: prior, weight: 1 }],
    startMs: 1000,
  })
})

describe('snaps rather than animating', () => {
  test('where motion is not allowed', () => {
    expect(
      transitionsAfter(decision(), decision({ rung: 2 }), { allowed: false })
        .size,
    ).toBe(0)
  })
  test('on a contig change', () => {
    expect(
      transitionsAfter(decision(), decision({ refName: 'chr3' })).size,
    ).toBe(0)
  })
  test("on a lane's first decision", () => {
    expect(transitionsAfter(undefined, decision()).size).toBe(0)
  })
  test('on a re-decision that moves nothing on screen', () => {
    expect(
      transitionsAfter(decision(), decision({ fitMin: 996_000, alsoOn: ['x'] }))
        .size,
    ).toBe(0)
  })
  test('on a leap of several rungs at once', () => {
    expect(transitionsAfter(decision(), decision({ rung: 5 })).size).toBe(0)
    expect(transitionsAfter(decision(), decision({ rung: 3 })).size).toBe(1)
    expect(
      transitionsAfter(decision({ rung: 40 }), decision({ rung: 1 })).size,
    ).toBe(1)
  })
  test('on a jump whose two pictures share nothing on screen', () => {
    expect(
      transitionsAfter(decision(), decision({ pivotLaneBp: 1_024_234 })).size,
    ).toBe(0)
  })
  test('where the old pivot is off the displayed regions', () => {
    const prior = decision()
    expect(
      transitionsAfter(prior, decision({ rung: 2 }), {
        frameOf: d => (d === prior ? undefined : frameOf(d)),
      }).size,
    ).toBe(0)
  })
})

test('an unchanged decision keeps the transition it is running', () => {
  const prior = decision()
  const running: LaneTransition = { from: [], startMs: 900 }
  const t = transitionsAfter(prior, prior, {
    running: new Map([['lane', running]]),
  })
  expect(t.get('lane')).toBe(running)
})

// canvas's morph re-seeds from `captureFeatureTops` at the drawn progress;
// this one from the mix of frames the lane was drawn between
test('a second settle mid-flight starts from where the lane is drawn, without a snap', () => {
  const first = decision()
  const second = decision({ pivotLaneBp: 1_002_000, rung: 2 })
  const third = decision({ pivotLaneBp: 999_000, flipped: true })
  const running: LaneTransition = {
    from: [{ decision: first, weight: 1 }],
    startMs: 0,
  }
  const drawnAtMs = 0.4 * MORPH_DURATION_MS
  const e = laneMotionEase(running, drawnAtMs)
  const before = drawnAt(frameOf(first), frameOf(second), e)

  const next = transitionsAfter(second, third, {
    running: new Map([['lane', running]]),
    drawnAtMs,
  }).get('lane')!
  const map = laneMapAt(
    next.from.map(({ decision, weight }) => ({
      frame: frameOf(decision),
      weight,
    })),
    frameOf(third),
    0,
    W,
  )
  const after = SAMPLES.map(bp =>
    drawnPx(map, rowFrameX(frameOf(third), bp, W)),
  )
  after.forEach((x, i) => {
    expect(x).toBeCloseTo(before[i]!, 6)
  })
})
