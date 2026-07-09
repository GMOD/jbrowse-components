import { fitSqueezeScale, resolveFitLadder } from './fitLadder.ts'
import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'

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

describe('fitSqueezeScale', () => {
  it('leaves a stack that already fits unscaled', () => {
    expect(fitSqueezeScale(100, 200, 0.2)).toBe(1)
  })

  it('never enlarges (clamps to 1) even when the track is much taller', () => {
    expect(fitSqueezeScale(50, 500, 0.2)).toBe(1)
  })

  it('squeezes an overflowing stack to fill the track exactly', () => {
    expect(fitSqueezeScale(200, 100, 0.2)).toBeCloseTo(0.5)
  })

  it('floors at minScale rather than shrinking the body to nothing', () => {
    // 100/1000 = 0.1 would fit, but that shrinks bodies below the floor, so it
    // holds at 0.2 and the surplus scrolls.
    expect(fitSqueezeScale(1000, 100, 0.2)).toBe(0.2)
  })

  it('is always within [minScale, 1]', () => {
    for (const content of [10, 100, 137, 1000, 9999]) {
      for (const track of [1, 50, 100, 500]) {
        const s = fitSqueezeScale(content, track, 0.2)
        expect(s).toBeGreaterThanOrEqual(0.2)
        expect(s).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('resolveFitLadder', () => {
  it('keeps the least-reduced rung that fits, at scale 1', () => {
    const rungs: FitRung[] = [
      { level: 'full', layout: () => layoutOfHeight(80) },
      { level: 'labels', layout: () => layoutOfHeight(50) },
      { level: 'bodies', layout: () => layoutOfHeight(30) },
    ]
    const stage = resolveFitLadder(rungs, 100, 0.2)
    expect(stage.level).toBe('full')
    expect(stage.scale).toBe(1)
  })

  it('descends to the first rung whose unscaled stack fits', () => {
    const rungs: FitRung[] = [
      { level: 'full', layout: () => layoutOfHeight(300) },
      { level: 'labels', layout: () => layoutOfHeight(90) },
      { level: 'bodies', layout: () => layoutOfHeight(30) },
    ]
    const stage = resolveFitLadder(rungs, 100, 0.2)
    expect(stage.level).toBe('labels')
    expect(stage.scale).toBe(1)
  })

  it('squeezes the last rung when nothing fits at scale 1', () => {
    const rungs: FitRung[] = [
      { level: 'full', layout: () => layoutOfHeight(300) },
      { level: 'labels', layout: () => layoutOfHeight(200) },
      { level: 'bodies', layout: () => layoutOfHeight(200) },
    ]
    const stage = resolveFitLadder(rungs, 100, 0.2)
    expect(stage.level).toBe('bodies')
    expect(stage.scale).toBeCloseTo(0.5)
  })

  it('floors the last-rung squeeze at minScale (overflow then scrolls)', () => {
    const rungs: FitRung[] = [
      { level: 'full', layout: () => layoutOfHeight(300) },
      { level: 'labels', layout: () => layoutOfHeight(250) },
      { level: 'bodies', layout: () => layoutOfHeight(1000) },
    ]
    const stage = resolveFitLadder(rungs, 100, 0.2)
    expect(stage.level).toBe('bodies')
    expect(stage.scale).toBe(0.2)
  })

  it('never lays out a rung tighter than the one it keeps', () => {
    const full = spyRung('full', 80)
    const labels = spyRung('labels', 50)
    const bodies = spyRung('bodies', 30)
    resolveFitLadder([full.rung, labels.rung, bodies.rung], 100, 0.2)
    expect(full.calls.count).toBe(1)
    expect(labels.calls.count).toBe(0)
    expect(bodies.calls.count).toBe(0)
  })

  it('lays out every rung only when it must squeeze the last', () => {
    const full = spyRung('full', 300)
    const labels = spyRung('labels', 250)
    const bodies = spyRung('bodies', 200)
    resolveFitLadder([full.rung, labels.rung, bodies.rung], 100, 0.2)
    expect(full.calls.count).toBe(1)
    expect(labels.calls.count).toBe(1)
    expect(bodies.calls.count).toBe(1)
  })
})
