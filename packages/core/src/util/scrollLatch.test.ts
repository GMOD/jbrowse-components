import { createScrollLatch } from './scrollLatch.ts'

// minimal stand-in for a WheelEvent: scroll() only reads timestamp and calls
// preventDefault, so a tracked spy is enough
function wheelEvent(timestamp: number) {
  let prevented = false
  return {
    timeStamp: timestamp,
    preventDefault() {
      prevented = true
    },
    get prevented() {
      return prevented
    },
  } as unknown as WheelEvent & { prevented: boolean }
}

test('scrolls and clamps within bounds', () => {
  const latch = createScrollLatch()
  const e = wheelEvent(0)
  expect(latch.scroll(e, 10, 30, 100)).toBe(40)
  expect(e.prevented).toBe(true)
})

test('clamps to max and returns null when already at the boundary', () => {
  const latch = createScrollLatch()
  expect(latch.scroll(wheelEvent(0), 100, 50, 100)).toBe(null)
})

test('clamps to min and returns null when already at the top', () => {
  const latch = createScrollLatch()
  expect(latch.scroll(wheelEvent(0), 0, -50, 100)).toBe(null)
})

test('a fresh boundary event releases to the page (no preventDefault)', () => {
  const latch = createScrollLatch()
  const e = wheelEvent(0)
  expect(latch.scroll(e, 100, 50, 100)).toBe(null)
  expect(e.prevented).toBe(false)
})

test('a boundary event within the latch window stays latched', () => {
  const latch = createScrollLatch(200)
  // consume a real scroll at t=0
  latch.scroll(wheelEvent(0), 50, 60, 100)
  // hit the boundary 50ms later — still mid-gesture, suppress chaining
  const e = wheelEvent(50)
  expect(latch.scroll(e, 100, 30, 100)).toBe(null)
  expect(e.prevented).toBe(true)
})

test('a boundary event after the latch window releases to the page', () => {
  const latch = createScrollLatch(200)
  latch.scroll(wheelEvent(0), 50, 60, 100)
  // 300ms later the gesture has paused, so the page may take over
  const e = wheelEvent(300)
  expect(latch.scroll(e, 100, 30, 100)).toBe(null)
  expect(e.prevented).toBe(false)
})

test('continuous over-scroll at the boundary stays latched past the window', () => {
  const latch = createScrollLatch(200)
  latch.scroll(wheelEvent(0), 50, 60, 100) // consume, panel reaches max=100
  // keep pushing into the boundary every 50ms; the panel never moves again but
  // the gesture never pauses, so the page must stay suppressed the whole time
  for (const t of [50, 100, 150, 200, 250, 300, 350, 400]) {
    const e = wheelEvent(t)
    expect(latch.scroll(e, 100, 30, 100)).toBe(null)
    expect(e.prevented).toBe(true)
  }
})

test('a gesture that starts at the boundary chains to the page immediately', () => {
  const latch = createScrollLatch(200)
  // never scrolled the panel; continuous events at the boundary should all
  // release to the page since the gesture never latched onto the panel
  for (const t of [0, 50, 100, 150]) {
    const e = wheelEvent(t)
    expect(latch.scroll(e, 100, 30, 100)).toBe(null)
    expect(e.prevented).toBe(false)
  }
})

test('each consumed scroll refreshes the latch window', () => {
  const latch = createScrollLatch(200)
  latch.scroll(wheelEvent(0), 0, 60, 100) // consume
  latch.scroll(wheelEvent(150), 60, 40, 100) // consume again, window now from 150
  // 300ms is >200 from t=0 but only 150 from the last consume — still latched
  const e = wheelEvent(300)
  expect(latch.scroll(e, 100, 30, 100)).toBe(null)
  expect(e.prevented).toBe(true)
})

test('reset releases a boundary event that would otherwise stay latched', () => {
  const latch = createScrollLatch(200)
  latch.scroll(wheelEvent(0), 50, 60, 100) // consume, window opens at 0
  latch.reset()
  // 50ms later would normally stay latched, but reset cleared the window
  const e = wheelEvent(50)
  expect(latch.scroll(e, 100, 30, 100)).toBe(null)
  expect(e.prevented).toBe(false)
})
