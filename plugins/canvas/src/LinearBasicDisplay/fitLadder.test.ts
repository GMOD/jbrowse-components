import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import {
  bisectLargestFitting,
  bisectSmallestFitting,
  fitScaleToFill,
  resolveFitLadder,
  snapFittedContentHeight,
  solveIsoformCount,
  squeezeFloorScale,
} from './fitLadder.ts'

import type { FitRung, LabelReservation } from './fitLadder.ts'

const NO_LABELS: LabelReservation = {
  showLabels: false,
  showDescriptions: false,
  dropBelowLabelRows: false,
}

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

function spyRung(level: FitRung['level'], bottomPx: number) {
  const calls = { count: 0 }
  const rung: FitRung = {
    level,
    reserved: NO_LABELS,
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
    expect(fitScaleToFill(10, 100, 0.2, 3)).toBe(3)
  })

  it('does not grow when maxScale is 1', () => {
    expect(fitScaleToFill(50, 500, 0.2, 1)).toBe(1)
  })

  it('squeezes an overflowing stack to fill the track exactly', () => {
    expect(fitScaleToFill(200, 100, 0.2, 3)).toBeCloseTo(0.5)
  })

  it('floors at minScale rather than shrinking the body to nothing', () => {
    expect(fitScaleToFill(1000, 100, 0.2, 3)).toBe(0.2)
  })

  it('answers 1 for an empty stack rather than Infinity/maxScale', () => {
    expect(fitScaleToFill(0, 100, 0.2, 3)).toBe(1)
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

describe('squeezeFloorScale', () => {
  it('allows the squeeze that lands the shortest body exactly on the minimum', () => {
    expect(squeezeFloorScale(10, 2)).toBe(0.2)
  })

  it('offers no squeeze once the shortest body is at or under the minimum', () => {
    expect(squeezeFloorScale(2, 2)).toBe(1)
    expect(squeezeFloorScale(1, 2)).toBe(1)
  })

  it('offers no squeeze for an empty stack rather than dividing by zero', () => {
    expect(squeezeFloorScale(0, 2)).toBe(1)
  })

  it('is always a usable scale in (0, 1]', () => {
    for (const body of [0, 0.5, 1, 2, 3, 10, 137, 4000]) {
      const s = squeezeFloorScale(body, 2)
      expect(s).toBeGreaterThan(0)
      expect(s).toBeLessThanOrEqual(1)
      expect(body * s).toBeGreaterThanOrEqual(Math.min(body, 2) - 1e-9)
    }
  })
})

describe('bisectSmallestFitting', () => {
  const fitsAbove = (threshold: number) => (x: number) => x >= threshold

  it('converges on the threshold from above', () => {
    const found = bisectSmallestFitting(fitsAbove(3), 0, 8, 20)
    expect(found).toBeCloseTo(3, 4)
    expect(fitsAbove(3)(found)).toBe(true)
  })

  it('only ever returns a value that fits', () => {
    for (const threshold of [0.1, 1, 2.5, 6, 7.99]) {
      const found = bisectSmallestFitting(fitsAbove(threshold), 0, 8, 8)
      expect(fitsAbove(threshold)(found)).toBe(true)
    }
  })

  it('returns hi untouched when no iterations are allowed', () => {
    expect(bisectSmallestFitting(fitsAbove(3), 0, 8, 0)).toBe(8)
  })

  it('narrows by half per iteration', () => {
    const width = (iters: number) =>
      bisectSmallestFitting(fitsAbove(3), 0, 8, iters) - 3
    expect(width(4)).toBeLessThanOrEqual(8 / 2 ** 4)
    expect(width(8)).toBeLessThanOrEqual(8 / 2 ** 8)
  })
})

describe('bisectLargestFitting', () => {
  it('finds the largest fitting integer', () => {
    expect(bisectLargestFitting(x => x <= 7, 1, 40)).toBe(7)
    expect(bisectLargestFitting(x => x <= 1, 1, 40)).toBe(1)
    expect(bisectLargestFitting(x => x <= 39, 1, 40)).toBe(39)
  })

  it('probes O(log n) times, not n', () => {
    let calls = 0
    bisectLargestFitting(
      x => {
        calls++
        return x <= 17
      },
      1,
      1000,
    )
    expect(calls).toBeLessThan(12)
  })
})

describe('solveIsoformCount', () => {
  const heightAt = (n: number) => n * 12

  it('answers the largest count that fits', () => {
    expect(solveIsoformCount(heightAt, 60, 10, 1)).toBe(5)
  })

  it('answers nothing when the whole stack fits', () => {
    expect(solveIsoformCount(heightAt, 600, 10, 1)).toBeUndefined()
  })

  it('answers the caller’s floor when even one per gene overflows', () => {
    expect(solveIsoformCount(heightAt, 5, 10, 1)).toBe(1)
    expect(solveIsoformCount(heightAt, 5, 10, undefined)).toBeUndefined()
  })

  it('ignores the floor wherever a count fits', () => {
    expect(solveIsoformCount(heightAt, 60, 10, undefined)).toBe(5)
    expect(solveIsoformCount(heightAt, 12, 10, undefined)).toBe(1)
  })

  it('answers nothing when no gene has a choice to make', () => {
    expect(solveIsoformCount(heightAt, 1, 1, 1)).toBeUndefined()
    expect(solveIsoformCount(heightAt, 1, 0, 1)).toBeUndefined()
  })
})

describe('snapFittedContentHeight', () => {
  it('swallows a sub-pixel overflow while squeezing', () => {
    expect(snapFittedContentHeight(100.4, 100, true)).toBe(100)
  })

  it('never rounds a fitting stack up to the track height', () => {
    expect(snapFittedContentHeight(96, 100, true)).toBe(96)
  })

  it('keeps a real (>=1px) overflow so it scrolls', () => {
    expect(snapFittedContentHeight(130, 100, true)).toBe(130)
  })

  it('leaves the raw height untouched when not squeezing', () => {
    expect(snapFittedContentHeight(100.4, 100, false)).toBe(100.4)
    expect(snapFittedContentHeight(130, 100, false)).toBe(130)
  })
})

describe('resolveFitLadder', () => {
  it('reports the kept rung’s reservation', () => {
    const reserved: LabelReservation = {
      showLabels: true,
      showDescriptions: false,
      dropBelowLabelRows: true,
    }
    const stage = resolveFitLadder(
      [
        {
          level: 'full',
          reserved: NO_LABELS,
          layout: () => layoutOfHeight(300),
        },
        { level: 'labels', reserved, layout: () => layoutOfHeight(90) },
      ],
      100,
      0.2,
      1,
    )
    expect(stage).toMatchObject(reserved)
  })

  it('reports the kept rung’s isoform count', () => {
    const stage = resolveFitLadder(
      [
        {
          level: 'full',
          reserved: NO_LABELS,
          layout: () => layoutOfHeight(300),
        },
        {
          level: 'labels',
          reserved: NO_LABELS,
          layout: () => layoutOfHeight(200),
        },
        {
          level: 'isoforms',
          reserved: NO_LABELS,
          layout: () => layoutOfHeight(90),
          maxIsoforms: () => 5,
        },
      ],
      100,
      0.2,
      1,
    )
    expect(stage.level).toBe('isoforms')
    expect(stage.maxIsoforms).toBe(5)
  })

  it('reports no count on a rung that trimmed nothing', () => {
    const stage = resolveFitLadder(
      [
        {
          level: 'full',
          reserved: NO_LABELS,
          layout: () => layoutOfHeight(90),
        },
      ],
      100,
      0.2,
      1,
    )
    expect(stage.maxIsoforms).toBeUndefined()
  })

  it('lets the rungs below inherit the count the trim failed at', () => {
    const stage = resolveFitLadder(
      [
        {
          level: 'full',
          reserved: NO_LABELS,
          layout: () => layoutOfHeight(300),
        },
        {
          level: 'isoforms',
          reserved: NO_LABELS,
          layout: () => layoutOfHeight(200),
          maxIsoforms: () => 1,
        },
        {
          level: 'bodies',
          reserved: NO_LABELS,
          layout: () => layoutOfHeight(80),
          maxIsoforms: () => 1,
        },
      ],
      100,
      0.2,
      1,
    )
    expect(stage.level).toBe('bodies')
    expect(stage.maxIsoforms).toBe(1)
  })

  it('keeps the least-reduced rung that fills the track, at scale 1', () => {
    const rungs: [FitRung, ...FitRung[]] = [
      { level: 'full', reserved: NO_LABELS, layout: () => layoutOfHeight(100) },
      {
        level: 'labels',
        reserved: NO_LABELS,
        layout: () => layoutOfHeight(50),
      },
      {
        level: 'bodies',
        reserved: NO_LABELS,
        layout: () => layoutOfHeight(30),
      },
    ]
    const stage = resolveFitLadder(rungs, 100, 0.2, 3)
    expect(stage.level).toBe('full')
    expect(stage.scale).toBe(1)
  })

  it('grows the kept rung to fill the track when it fits with room to spare', () => {
    const rungs: [FitRung, ...FitRung[]] = [
      { level: 'full', reserved: NO_LABELS, layout: () => layoutOfHeight(50) },
      {
        level: 'labels',
        reserved: NO_LABELS,
        layout: () => layoutOfHeight(30),
      },
      {
        level: 'bodies',
        reserved: NO_LABELS,
        layout: () => layoutOfHeight(20),
      },
    ]
    const stage = resolveFitLadder(rungs, 100, 0.2, 3)
    expect(stage.level).toBe('full')
    expect(stage.scale).toBeCloseTo(2)
  })

  it('caps the grow at maxScale (surplus stays whitespace)', () => {
    const rungs: [FitRung, ...FitRung[]] = [
      { level: 'full', reserved: NO_LABELS, layout: () => layoutOfHeight(10) },
    ]
    const stage = resolveFitLadder(rungs, 100, 0.2, 3)
    expect(stage.level).toBe('full')
    expect(stage.scale).toBe(3)
  })

  it('descends to the first rung whose unscaled stack fits, then grows it', () => {
    const rungs: [FitRung, ...FitRung[]] = [
      { level: 'full', reserved: NO_LABELS, layout: () => layoutOfHeight(300) },
      {
        level: 'labels',
        reserved: NO_LABELS,
        layout: () => layoutOfHeight(90),
      },
      {
        level: 'bodies',
        reserved: NO_LABELS,
        layout: () => layoutOfHeight(30),
      },
    ]
    const stage = resolveFitLadder(rungs, 100, 0.2, 3)
    expect(stage.level).toBe('labels')
    expect(stage.scale).toBeCloseTo(100 / 90)
  })

  it('descends through decimated to bodies and squeezes when nothing fits', () => {
    const rungs: [FitRung, ...FitRung[]] = [
      { level: 'full', reserved: NO_LABELS, layout: () => layoutOfHeight(400) },
      {
        level: 'labels',
        reserved: NO_LABELS,
        layout: () => layoutOfHeight(300),
      },
      {
        level: 'decimated',
        reserved: NO_LABELS,
        layout: () => layoutOfHeight(200),
      },
      {
        level: 'bodies',
        reserved: NO_LABELS,
        layout: () => layoutOfHeight(200),
      },
    ]
    const stage = resolveFitLadder(rungs, 100, 0.2, 3)
    expect(stage.level).toBe('bodies')
    expect(stage.scale).toBeCloseTo(0.5)
  })

  it('keeps the decimated rung when it fits but labels does not', () => {
    const rungs: [FitRung, ...FitRung[]] = [
      { level: 'full', reserved: NO_LABELS, layout: () => layoutOfHeight(300) },
      {
        level: 'labels',
        reserved: NO_LABELS,
        layout: () => layoutOfHeight(150),
      },
      {
        level: 'decimated',
        reserved: NO_LABELS,
        layout: () => layoutOfHeight(90),
      },
      {
        level: 'bodies',
        reserved: NO_LABELS,
        layout: () => layoutOfHeight(40),
      },
    ]
    const stage = resolveFitLadder(rungs, 100, 0.2, 3)
    expect(stage.level).toBe('decimated')
    expect(stage.scale).toBeCloseTo(100 / 90)
  })

  it('floors the last-rung squeeze at minScale (overflow then scrolls)', () => {
    const rungs: [FitRung, ...FitRung[]] = [
      { level: 'full', reserved: NO_LABELS, layout: () => layoutOfHeight(300) },
      {
        level: 'labels',
        reserved: NO_LABELS,
        layout: () => layoutOfHeight(250),
      },
      {
        level: 'bodies',
        reserved: NO_LABELS,
        layout: () => layoutOfHeight(1000),
      },
    ]
    const stage = resolveFitLadder(rungs, 100, 0.2, 3)
    expect(stage.level).toBe('bodies')
    expect(stage.scale).toBe(0.2)
  })

  it('treats reference-identical rungs as one stack', () => {
    const shared = layoutOfHeight(200)
    let measured = 0
    const sharedRung = (level: FitRung['level']): FitRung => ({
      level,
      reserved: NO_LABELS,
      layout: () => {
        measured++
        return shared
      },
    })
    const stage = resolveFitLadder(
      [
        {
          level: 'full',
          reserved: NO_LABELS,
          layout: () => layoutOfHeight(400),
        },
        sharedRung('labels'),
        sharedRung('decimated'),
        sharedRung('bodies'),
      ],
      100,
      0.2,
      3,
    )
    expect(measured).toBe(3)
    expect(stage.level).toBe('bodies')
    expect(stage.contentHeight).toBe(200)
    expect(stage.scale).toBeCloseTo(0.5)
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
