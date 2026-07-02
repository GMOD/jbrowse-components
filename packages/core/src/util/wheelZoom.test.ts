import {
  SCROLL_ZOOM_FACTOR_DIVISOR,
  ZOOM_ACTIVE_WINDOW_MS,
  applyZoomAccum,
  getZoomNormalizer,
  isActivelyZooming,
  normalizeWheelDelta,
  wheelFrameElapsedMs,
  wheelZoomAccum,
} from './wheelZoom.ts'

describe('getZoomNormalizer', () => {
  test('returns 25 for very small deltas (abs < 6)', () => {
    expect(getZoomNormalizer(1)).toBe(25)
    expect(getZoomNormalizer(5)).toBe(25)
    expect(getZoomNormalizer(-3)).toBe(25)
  })

  test('returns 75 for small deltas (6 <= abs <= 30)', () => {
    expect(getZoomNormalizer(6)).toBe(75)
    expect(getZoomNormalizer(30)).toBe(75)
    expect(getZoomNormalizer(-20)).toBe(75)
  })

  test('returns 150 for medium deltas (30 < abs <= 150)', () => {
    expect(getZoomNormalizer(31)).toBe(150)
    expect(getZoomNormalizer(150)).toBe(150)
    expect(getZoomNormalizer(-100)).toBe(150)
  })

  test('returns 500 for large deltas (abs > 150)', () => {
    expect(getZoomNormalizer(151)).toBe(500)
    expect(getZoomNormalizer(500)).toBe(500)
    expect(getZoomNormalizer(-200)).toBe(500)
  })
})

describe('normalizeWheelDelta', () => {
  test('pixel mode (0) passes through unchanged', () => {
    expect(normalizeWheelDelta(10, 0)).toBe(10)
    expect(normalizeWheelDelta(-5, 0)).toBe(-5)
  })

  test('line mode (1) multiplies by 40', () => {
    expect(normalizeWheelDelta(3, 1)).toBe(120)
    expect(normalizeWheelDelta(-2, 1)).toBe(-80)
  })

  test('page mode (2) uses the default page height', () => {
    expect(normalizeWheelDelta(1, 2)).toBe(800)
    expect(normalizeWheelDelta(-2, 2)).toBe(-1600)
  })

  test('page mode (2) honors an explicit pageHeight (panel scroll)', () => {
    expect(normalizeWheelDelta(2, 2, 500)).toBe(1000)
    expect(normalizeWheelDelta(1, 1, 500)).toBe(40)
    expect(normalizeWheelDelta(3, 0, 500)).toBe(3)
  })
})

describe('wheelFrameElapsedMs', () => {
  test('defaults to one 60fps frame when no prior frame', () => {
    expect(wheelFrameElapsedMs(1000, null)).toBeCloseTo(16.67)
  })

  test('returns elapsed since prior frame', () => {
    expect(wheelFrameElapsedMs(1050, 1000)).toBe(50)
  })

  test('clamps to 100ms', () => {
    expect(wheelFrameElapsedMs(2000, 1000)).toBe(100)
  })
})

describe('applyZoomAccum', () => {
  test('positive accum zooms out (bigger bpPerPx)', () => {
    expect(applyZoomAccum(10, 0.1, 16.67)).toBeCloseTo(11)
  })

  test('negative accum zooms in (smaller bpPerPx)', () => {
    expect(applyZoomAccum(10, -0.1, 16.67)).toBeCloseTo(10 / 1.1)
  })

  test('rate-limits a large accum to MAX_ZOOM_RATE_PER_MS * elapsed', () => {
    // capped at 0.2/16.67 * 16.67 = 0.2 per frame
    expect(applyZoomAccum(10, 5, 16.67)).toBeCloseTo(12)
  })
})

describe('wheelZoomAccum', () => {
  test('ctrl zoom uses the adaptive normalizer', () => {
    expect(wheelZoomAccum(10, true)).toBeCloseTo(10 / getZoomNormalizer(10))
    expect(wheelZoomAccum(200, true)).toBeCloseTo(200 / getZoomNormalizer(200))
  })

  test('scroll zoom uses the fixed divisor', () => {
    expect(wheelZoomAccum(10, false)).toBeCloseTo(
      10 / SCROLL_ZOOM_FACTOR_DIVISOR,
    )
    expect(wheelZoomAccum(200, false)).toBeCloseTo(
      200 / SCROLL_ZOOM_FACTOR_DIVISOR,
    )
  })
})

describe('isActivelyZooming', () => {
  test('not zooming before any zoom has occurred', () => {
    expect(isActivelyZooming(1000, null)).toBe(false)
  })

  test('still zooming within the window after a zoom event', () => {
    expect(isActivelyZooming(1000, 1000)).toBe(true)
    expect(isActivelyZooming(1000 + ZOOM_ACTIVE_WINDOW_MS - 1, 1000)).toBe(true)
  })

  test('no longer zooming once the window elapses', () => {
    expect(isActivelyZooming(1000 + ZOOM_ACTIVE_WINDOW_MS, 1000)).toBe(false)
    expect(isActivelyZooming(5000, 1000)).toBe(false)
  })
})

describe('zoomAccum coalescing', () => {
  // Regression for the zoomDivisor last-wins bug: when two wheel events
  // coalesce in a single RAF frame and have different normalizers, the zoom
  // should equal the sum of each event's individual contribution, not the
  // combined delta divided by the last event's normalizer.
  function simulateAccum(events: number[]) {
    let zoomAccum = 0
    for (const deltaY of events) {
      zoomAccum += deltaY / getZoomNormalizer(deltaY)
    }
    return zoomAccum
  }

  test('single event normalizes correctly', () => {
    expect(simulateAccum([10])).toBeCloseTo(10 / 75)
    expect(simulateAccum([3])).toBeCloseTo(3 / 25)
    expect(simulateAccum([200])).toBeCloseTo(200 / 500)
  })

  test('two same-normalizer events accumulate additively', () => {
    expect(simulateAccum([3, 3])).toBeCloseTo(6 / 25)
  })

  test('two different-normalizer events use per-event divisors', () => {
    // delta=1 (normalizer=25) then delta=10 (normalizer=75)
    const correct = 1 / 25 + 10 / 75
    expect(simulateAccum([1, 10])).toBeCloseTo(correct)

    // old last-wins bug would have computed (1+10)/75 = 0.1467 instead of 0.1733
    const buggy = (1 + 10) / getZoomNormalizer(10)
    expect(simulateAccum([1, 10])).not.toBeCloseTo(buggy)
  })

  test('order does not affect accumulated result', () => {
    expect(simulateAccum([1, 10])).toBeCloseTo(simulateAccum([10, 1]))
  })
})
