import { springAnimate } from './springAnimate.ts'

beforeEach(() => {
  jest.useFakeTimers()
})
afterEach(() => {
  jest.useRealTimers()
})

test('reaches its target', () => {
  const state = { value: 0 }
  const [animate] = springAnimate({
    from: 0,
    to: 100,
    read: () => state.value,
    write: v => {
      state.value = v
    },
  })
  animate()
  jest.advanceTimersByTime(5000)
  expect(state.value).toBe(100)
})

// a slow spring (~320 frames to converge) so the interference below lands
// mid-flight, where a real one does — between two frames, not inside `write`
const SLOW = { tension: 50, friction: 40 }

test('yields once something else moves the value', () => {
  const state = { value: 0 }
  const [animate] = springAnimate({
    ...SLOW,
    from: 0,
    to: 100,
    read: () => state.value,
    write: v => {
      state.value = v
    },
  })
  animate()
  jest.advanceTimersByTime(100)
  expect(state.value).toBeGreaterThan(0)
  expect(state.value).toBeLessThan(100)

  state.value = -7
  jest.advanceTimersByTime(5000)
  // the spring read -7 on its next frame and stopped, rather than writing over it
  expect(state.value).toBe(-7)
})

// a `write` that stores something other than the value it was handed — LGV's
// scrollTo clamps, its zoomTo ignores sub-epsilon steps — must not read as
// interference. Rounding rather than clamping, so the assertion discriminates: a
// spring comparing against the value it *asked* for would bail on frame two and
// leave a small value, where clamping ends at the bound either way.
test('a write that transforms its value does not read as interference', () => {
  const state = { value: 0 }
  const [animate] = springAnimate({
    from: 0,
    to: 100,
    read: () => state.value,
    write: v => {
      state.value = Math.round(v)
    },
  })
  animate()
  jest.advanceTimersByTime(5000)
  expect(state.value).toBe(100)
})

// without `read` the spring owns the value outright and never checks
test('no read means no yielding', () => {
  let value = 0
  const [animate] = springAnimate({
    from: 0,
    to: 100,
    write: v => {
      value = v
    },
  })
  animate()
  value = -7
  jest.advanceTimersByTime(5000)
  expect(value).toBe(100)
})
