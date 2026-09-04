import {
  createWheelZoomController,
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

describe('createWheelZoomController', () => {
  let frames: FrameRequestCallback[] = []
  let element: HTMLDivElement
  let dispose: (() => void) | undefined

  function runFrame(now: number) {
    const pending = frames
    frames = []
    for (const frame of pending) {
      frame(now)
    }
  }

  // jsdom sets timeStamp from a clock we can't advance, so shadow it — the
  // mid-zoom suppression window is defined in event-timeStamp terms
  function wheel(
    init: WheelEventInit & { timeStamp?: number },
    target: EventTarget = element,
  ) {
    const event = new WheelEvent('wheel', {
      cancelable: true,
      bubbles: true,
      ...init,
    })
    Object.defineProperty(event, 'timeStamp', { value: init.timeStamp ?? 1000 })
    target.dispatchEvent(event)
    return event
  }

  function makeView(bpPerPx = 10) {
    return {
      bpPerPx,
      zoomTo: jest.fn(),
      horizontalScroll: jest.fn(),
    }
  }

  beforeEach(() => {
    frames = []
    jest
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation(callback => frames.push(callback))
    jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {})
    element = document.createElement('div')
    document.body.append(element)
  })

  afterEach(() => {
    dispose?.()
    dispose = undefined
    element.remove()
    jest.restoreAllMocks()
  })

  function setup({
    views,
    scrollZoom,
    swallowUnhandled = false,
    releaseOnPointerLeave = false,
  }: {
    views: ReturnType<typeof makeView>[]
    scrollZoom: boolean
    swallowUnhandled?: boolean
    releaseOnPointerLeave?: boolean
  }) {
    dispose = createWheelZoomController({
      element,
      swallowUnhandled,
      releaseOnPointerLeave,
      resolveTarget: () => ({
        views,
        scrollZoom,
        originElement: () => element,
      }),
    })
  }

  test('ctrl+wheel zooms even with scrollZoom off', () => {
    const view = makeView()
    setup({ views: [view], scrollZoom: false })
    const event = wheel({ deltaY: 100, ctrlKey: true, clientX: 400 })
    expect(event.defaultPrevented).toBe(true)
    expect(view.zoomTo).not.toHaveBeenCalled()

    runFrame(1000)
    expect(view.zoomTo).toHaveBeenCalledTimes(1)
    // jsdom reports a zero rect, so the anchor offset is clientX itself
    expect(view.zoomTo.mock.calls[0]![1]).toBe(400)
    // zooming out: deltaY > 0 raises bpPerPx
    expect(view.zoomTo.mock.calls[0]![0]).toBeGreaterThan(view.bpPerPx)
  })

  test('a burst of events collapses to one update per frame', () => {
    const view = makeView()
    setup({ views: [view], scrollZoom: true })
    for (let i = 0; i < 12; i++) {
      wheel({ deltaY: -20, clientX: 100 })
    }
    expect(globalThis.requestAnimationFrame).toHaveBeenCalledTimes(1)

    runFrame(1000)
    expect(view.zoomTo).toHaveBeenCalledTimes(1)
    // zooming in: accumulated negative deltaY lowers bpPerPx
    expect(view.zoomTo.mock.calls[0]![0]).toBeLessThan(view.bpPerPx)
  })

  test('drives every view in the target from one gesture', () => {
    const views = [makeView(10), makeView(20)]
    setup({ views, scrollZoom: true })
    wheel({ deltaY: -20, clientX: 100 })
    runFrame(1000)

    for (const view of views) {
      expect(view.zoomTo).toHaveBeenCalledTimes(1)
      expect(view.zoomTo.mock.calls[0]![0]).toBeLessThan(view.bpPerPx)
    }
  })

  test('scrollZoom treats a dominant deltaX as a pan, not a zoom', () => {
    const view = makeView()
    setup({ views: [view], scrollZoom: true })
    wheel({ deltaX: 30, deltaY: 5 })
    runFrame(1000)

    expect(view.zoomTo).not.toHaveBeenCalled()
    expect(view.horizontalScroll).toHaveBeenCalledWith(30)
  })

  test('a plain vertical wheel with scrollZoom off is left to the page', () => {
    const view = makeView()
    setup({ views: [view], scrollZoom: false })
    const event = wheel({ deltaY: 100 })
    runFrame(1000)

    expect(event.defaultPrevented).toBe(false)
    expect(view.zoomTo).not.toHaveBeenCalled()
    expect(view.horizontalScroll).not.toHaveBeenCalled()
  })

  test('swallowUnhandled consumes a gesture it takes no action on', () => {
    const view = makeView()
    setup({ views: [view], scrollZoom: false, swallowUnhandled: true })
    const event = wheel({ deltaY: 100 })

    expect(event.defaultPrevented).toBe(true)
    expect(view.zoomTo).not.toHaveBeenCalled()
  })

  test('shift+wheel escapes to native scroll while scrollZoom is on', () => {
    const view = makeView()
    setup({ views: [view], scrollZoom: true })
    const event = wheel({ deltaY: 100, shiftKey: true })

    expect(event.defaultPrevented).toBe(false)
    expect(globalThis.requestAnimationFrame).not.toHaveBeenCalled()
  })

  test('a stray deltaX arriving mid-zoom is swallowed, not panned', () => {
    const view = makeView()
    setup({ views: [view], scrollZoom: true })
    wheel({ deltaY: -20, timeStamp: 1000 })
    const stray = wheel({
      deltaX: 40,
      timeStamp: 1000 + ZOOM_ACTIVE_WINDOW_MS - 1,
    })
    runFrame(1000)

    expect(stray.defaultPrevented).toBe(true)
    expect(view.horizontalScroll).not.toHaveBeenCalled()
  })

  test('a deltaX after the zoom window closes pans again', () => {
    const view = makeView()
    setup({ views: [view], scrollZoom: true })
    wheel({ deltaY: -20, timeStamp: 1000 })
    runFrame(1000)
    wheel({ deltaX: 40, timeStamp: 1000 + ZOOM_ACTIVE_WINDOW_MS })
    runFrame(1100)

    expect(view.horizontalScroll).toHaveBeenCalledWith(40)
  })

  test('a zoom drops side-scroll accumulated earlier in the same frame', () => {
    const view = makeView()
    setup({ views: [view], scrollZoom: true })
    wheel({ deltaX: 40, timeStamp: 1000 })
    wheel({ deltaY: -20, timeStamp: 1001 })
    runFrame(1000)

    expect(view.zoomTo).toHaveBeenCalledTimes(1)
    expect(view.horizontalScroll).not.toHaveBeenCalled()
  })

  test('an undefined target leaves the event alone', () => {
    dispose = createWheelZoomController({
      element,
      resolveTarget: () => undefined,
    })
    const event = wheel({ deltaY: 100, ctrlKey: true })

    expect(event.defaultPrevented).toBe(false)
    expect(globalThis.requestAnimationFrame).not.toHaveBeenCalled()
  })

  test('declines a wheel a nested panel already consumed', () => {
    const view = makeView()
    setup({ views: [view], scrollZoom: false })
    // a display's virtual scroll: it preventDefaults the vertical delta it took,
    // and the diagonal's horizontal component must not also pan the view
    const panel = document.createElement('div')
    element.append(panel)
    panel.addEventListener('wheel', e => {
      e.preventDefault()
    })
    wheel({ deltaX: 12, deltaY: 80 }, panel)
    runFrame(1000)

    expect(view.horizontalScroll).not.toHaveBeenCalled()
    expect(view.zoomTo).not.toHaveBeenCalled()
  })

  test('a vertical-dominant wheel does not pan on its deltaX noise', () => {
    const view = makeView()
    setup({ views: [view], scrollZoom: false })
    // what a trackpad emits on a plain vertical swipe: the genome must not
    // drift sideways, whether or not anything below reported the scroll —
    // the pinned-tracks block scrolls natively and reports nothing
    wheel({ deltaX: 3, deltaY: 60 })
    runFrame(1000)

    expect(view.horizontalScroll).not.toHaveBeenCalled()
  })

  test('pans a wheel a nested panel left alone', () => {
    const view = makeView()
    setup({ views: [view], scrollZoom: false })
    const panel = document.createElement('div')
    element.append(panel)
    wheel({ deltaX: 40 }, panel)
    runFrame(1000)

    expect(view.horizontalScroll).toHaveBeenCalledWith(40)
  })

  test('follows a latched gesture off the element by default', () => {
    const view = makeView()
    setup({ views: [view], scrollZoom: true })
    // a zoom slides a small target out from under a stationary cursor, so a
    // mouseleave mid-gesture must not abandon it
    element.dispatchEvent(new MouseEvent('mouseleave'))
    wheel({ deltaY: -20 })
    runFrame(1000)

    expect(view.zoomTo).toHaveBeenCalledTimes(1)
  })

  test('releaseOnPointerLeave stops handling once the pointer leaves', () => {
    const view = makeView()
    setup({ views: [view], scrollZoom: true, releaseOnPointerLeave: true })
    element.dispatchEvent(new MouseEvent('mouseleave'))
    const event = wheel({ deltaY: -20 })

    expect(event.defaultPrevented).toBe(false)
    expect(view.zoomTo).not.toHaveBeenCalled()

    element.dispatchEvent(new MouseEvent('mouseenter'))
    wheel({ deltaY: -20 })
    runFrame(1000)
    expect(view.zoomTo).toHaveBeenCalledTimes(1)
  })

  test('dispose detaches the listener', () => {
    const view = makeView()
    setup({ views: [view], scrollZoom: true })
    dispose?.()
    dispose = undefined
    const event = wheel({ deltaY: -20 })

    expect(event.defaultPrevented).toBe(false)
    expect(view.zoomTo).not.toHaveBeenCalled()
  })

  test('the rate limit scales with the frame gap, not the event count', () => {
    const view = makeView()
    setup({ views: [view], scrollZoom: true })
    // a single huge delta, so the accumulator is well past any frame's ceiling
    wheel({ deltaY: 5000, timeStamp: 1000 })
    runFrame(1000)
    const shortFrame = view.zoomTo.mock.calls[0]![0]

    view.zoomTo.mockClear()
    wheel({ deltaY: 5000, timeStamp: 1010 })
    runFrame(1060)
    const longFrame = view.zoomTo.mock.calls[0]![0]

    expect(longFrame).toBeGreaterThan(shortFrame)
  })
})
