import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import {
  fitScaleToFill,
  resolveFitLadder,
  snapFittedContentHeight,
} from './fitLadder.ts'

import type { FitRung } from './fitLadder.ts'

// A one-region layout whose content height (maxBottom) is exactly `bottomPx`.
function layoutOfHeight(bottomPx: number) {
  return new Map([
    [
      0,
      makeFeatureData({
        flatbushItems: [makeFlatbushItem({ featureId: 'f', bottomPx })],
      }),
    ],
  ])
}

// A rung that records whether its layout thunk was evaluated, so tests can assert
// the ladder never lays out a rung tighter than the one it keeps.
function spyRung(level: FitRung['level'], bottomPx: number) {
  const calls = { count: 0 }
  const rung: FitRung = {
    level,
    layout: () => {
      calls.count++
      return layoutOfHeight(bottomPx)
    },
  }
  return { rung, calls }
}

describe('fitScaleToFill', () => {
  it('leaves a stack that fills the track exactly unscaled', () => {
    expect(fitScaleToFill(100, 100, 0.2, 3)).toBe(1)
  })

  it('grows a stack that fits with room to spare so bodies fill the track', () => {
    expect(fitScaleToFill(50, 100, 0.2, 3)).toBeCloseTo(2)
  })

  it('caps the grow at maxScale rather than ballooning a sparse stack', () => {
    // 100/10 = 10 would fill the track, but that exceeds the max-box ceiling, so
    // it holds at 3 and the surplus stays whitespace.
    expect(fitScaleToFill(10, 100, 0.2, 3)).toBe(3)
  })

  it('does not grow when maxScale is 1', () => {
    expect(fitScaleToFill(50, 500, 0.2, 1)).toBe(1)
  })

  it('squeezes an overflowing stack to fill the track exactly', () => {
    expect(fitScaleToFill(200, 100, 0.2, 3)).toBeCloseTo(0.5)
  })

  it('floors at minScale rather than shrinking the body to nothing', () => {
    // 100/1000 = 0.1 would fit, but that shrinks bodies below the floor, so it
    // holds at 0.2 and the surplus scrolls.
    expect(fitScaleToFill(1000, 100, 0.2, 3)).toBe(0.2)
  })

  it('is always within [minScale, maxScale]', () => {
    for (const content of [10, 100, 137, 1000, 9999]) {
      for (const track of [1, 50, 100, 500]) {
        const s = fitScaleToFill(content, track, 0.2, 3)
        expect(s).toBeGreaterThanOrEqual(0.2)
        expect(s).toBeLessThanOrEqual(3)
      }
    }
  })
})

describe('snapFittedContentHeight', () => {
  it('swallows a sub-pixel overflow while squeezing', () => {
    // The multiply-then-measure round-trip that lands a hair over the track.
    expect(snapFittedContentHeight(100.4, 100, true)).toBe(100)
  })

  it('never rounds a fitting stack up to the track height', () => {
    // Below the track — a squeeze that fit with room to spare stays as measured.
    expect(snapFittedContentHeight(96, 100, true)).toBe(96)
  })

  it('keeps a real (>=1px) overflow so it scrolls', () => {
    // The min-box floor stopped the squeeze short of fitting.
    expect(snapFittedContentHeight(130, 100, true)).toBe(130)
  })

  it('leaves the raw height untouched when not squeezing', () => {
    // A rung that fit (scale 1) or non-fit mode: overflow here is genuine.
    expect(snapFittedContentHeight(100.4, 100, false)).toBe(100.4)
    expect(snapFittedContentHeight(130, 100, false)).toBe(130)
  })
})

describe('resolveFitLadder', () => {
  it('keeps the least-reduced rung that fills the track, at scale 1', () => {
    const rungs: [FitRung, ...FitRung[]] = [
      { level: 'full', layout: () => layoutOfHeight(100) },
      { level: 'labels', layout: () => layoutOfHeight(50) },
      { level: 'bodies', layout: () => layoutOfHeight(30) },
    ]
    const stage = resolveFitLadder(rungs, 100, 0.2, 3)
    expect(stage.level).toBe('full')
    expect(stage.scale).toBe(1)
  })

  it('grows the kept rung to fill the track when it fits with room to spare', () => {
    const rungs: [FitRung, ...FitRung[]] = [
      { level: 'full', layout: () => layoutOfHeight(50) },
      { level: 'labels', layout: () => layoutOfHeight(30) },
      { level: 'bodies', layout: () => layoutOfHeight(20) },
    ]
    const stage = resolveFitLadder(rungs, 100, 0.2, 3)
    expect(stage.level).toBe('full')
    expect(stage.scale).toBeCloseTo(2)
  })

  it('caps the grow at maxScale (surplus stays whitespace)', () => {
    const rungs: [FitRung, ...FitRung[]] = [
      { level: 'full', layout: () => layoutOfHeight(10) },
    ]
    const stage = resolveFitLadder(rungs, 100, 0.2, 3)
    expect(stage.level).toBe('full')
    expect(stage.scale).toBe(3)
  })

  it('descends to the first rung whose unscaled stack fits, then grows it', () => {
    const rungs: [FitRung, ...FitRung[]] = [
      { level: 'full', layout: () => layoutOfHeight(300) },
      { level: 'labels', layout: () => layoutOfHeight(90) },
      { level: 'bodies', layout: () => layoutOfHeight(30) },
    ]
    const stage = resolveFitLadder(rungs, 100, 0.2, 3)
    expect(stage.level).toBe('labels')
    expect(stage.scale).toBeCloseTo(100 / 90)
  })

  it('descends through decimated to bodies and squeezes when nothing fits', () => {
    const rungs: [FitRung, ...FitRung[]] = [
      { level: 'full', layout: () => layoutOfHeight(400) },
      { level: 'labels', layout: () => layoutOfHeight(300) },
      { level: 'decimated', layout: () => layoutOfHeight(200) },
      { level: 'bodies', layout: () => layoutOfHeight(200) },
    ]
    const stage = resolveFitLadder(rungs, 100, 0.2, 3)
    expect(stage.level).toBe('bodies')
    expect(stage.scale).toBeCloseTo(0.5)
  })

  it('keeps the decimated rung when it fits but labels does not', () => {
    const rungs: [FitRung, ...FitRung[]] = [
      { level: 'full', layout: () => layoutOfHeight(300) },
      { level: 'labels', layout: () => layoutOfHeight(150) },
      { level: 'decimated', layout: () => layoutOfHeight(90) },
      { level: 'bodies', layout: () => layoutOfHeight(40) },
    ]
    const stage = resolveFitLadder(rungs, 100, 0.2, 3)
    expect(stage.level).toBe('decimated')
    expect(stage.scale).toBeCloseTo(100 / 90)
  })

  it('floors the last-rung squeeze at minScale (overflow then scrolls)', () => {
    const rungs: [FitRung, ...FitRung[]] = [
      { level: 'full', layout: () => layoutOfHeight(300) },
      { level: 'labels', layout: () => layoutOfHeight(250) },
      { level: 'bodies', layout: () => layoutOfHeight(1000) },
    ]
    const stage = resolveFitLadder(rungs, 100, 0.2, 3)
    expect(stage.level).toBe('bodies')
    expect(stage.scale).toBe(0.2)
  })

  it('never lays out a rung tighter than the one it keeps', () => {
    const full = spyRung('full', 80)
    const labels = spyRung('labels', 50)
    const bodies = spyRung('bodies', 30)
    resolveFitLadder([full.rung, labels.rung, bodies.rung], 100, 0.2, 3)
    expect(full.calls.count).toBe(1)
    expect(labels.calls.count).toBe(0)
    expect(bodies.calls.count).toBe(0)
  })

  it('lays out every rung only when it must squeeze the last', () => {
    const full = spyRung('full', 300)
    const labels = spyRung('labels', 250)
    const bodies = spyRung('bodies', 200)
    resolveFitLadder([full.rung, labels.rung, bodies.rung], 100, 0.2, 3)
    expect(full.calls.count).toBe(1)
    expect(labels.calls.count).toBe(1)
    expect(bodies.calls.count).toBe(1)
  })
})
