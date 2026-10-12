import { reviewWindow } from './reviewWindow.ts'

test('centres the span on the sort column', () => {
  const w = reviewWindow(
    { start: 1000, end: 1004, sort: { type: 'basePair', pos: 1001 } },
    100,
    50_000,
  )
  expect((w.start + w.end) / 2).toBeCloseTo(1001.5, 0)
  expect(w.end - w.start).toBeGreaterThanOrEqual(100)
  expect(w.exceeded).toBe(false)
})

test('no sort centres on start', () => {
  const w = reviewWindow({ start: 1000, end: 1001 }, 100, 50_000)
  expect(Math.abs((w.start + w.end) / 2 - 1000.5)).toBeLessThanOrEqual(1)
})

test('an event wider than the span is shown whole with 10% padding', () => {
  expect(reviewWindow({ start: 1000, end: 2000 }, 100, 50_000)).toEqual({
    start: 900,
    end: 2100,
    exceeded: false,
  })
})

test('an event beyond maxReviewWindowBp centres on start and says so', () => {
  const w = reviewWindow({ start: 1000, end: 200_000 }, 100, 50_000)
  expect(w.exceeded).toBe(true)
  expect(w.end - w.start).toBeLessThanOrEqual(101)
})

test('never starts below zero', () => {
  expect(reviewWindow({ start: 3, end: 4 }, 100, 50_000).start).toBe(0)
})
