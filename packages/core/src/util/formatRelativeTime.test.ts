import { formatRelativeTime } from './formatRelativeTime.ts'

const now = Date.UTC(2026, 0, 1, 12, 0, 0)
const s = 1000
const min = 60 * s
const h = 60 * min
const d = 24 * h

function ago(ms: number) {
  return formatRelativeTime(now - ms, now)
}

test('picks the largest unit the duration fills', () => {
  expect(ago(0)).toBe('now')
  expect(ago(45 * s)).toBe('45 seconds ago')
  expect(ago(5 * min)).toBe('5 minutes ago')
  expect(ago(3 * h)).toBe('3 hours ago')
  expect(ago(d)).toBe('yesterday')
  expect(ago(3 * d)).toBe('3 days ago')
  expect(ago(2 * 7 * d)).toBe('2 weeks ago')
  expect(ago(3 * 30 * d)).toBe('3 months ago')
  expect(ago(2 * 365 * d)).toBe('2 years ago')
  expect(formatRelativeTime(now + 3 * d, now)).toBe('in 3 days')
})

// A duration just under a unit boundary used to be tested against the boundary
// unrounded and then printed rounded, so 59.6 seconds read "60 seconds ago"
// where the next unit up says "1 minute ago"; the same at every step gave
// "60 minutes ago", "24 hours ago" and "12 months ago".
test('a duration that rounds up to the next unit is printed in that unit', () => {
  expect(ago(59.6 * s)).toBe('1 minute ago')
  expect(ago(59.6 * min)).toBe('1 hour ago')
  expect(ago(23.6 * h)).toBe('yesterday')
  expect(ago(6.9 * d)).toBe('last week')
  expect(ago(11.7 * 30.4375 * d)).toBe('last year')
  expect(formatRelativeTime(now + 59.6 * s, now)).toBe('in 1 minute')
})

test('a duration that rounds down stays in its unit', () => {
  expect(ago(59.4 * s)).toBe('59 seconds ago')
  expect(ago(23.4 * h)).toBe('23 hours ago')
})
