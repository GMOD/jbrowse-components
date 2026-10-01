import { formatRelativeTime } from './formatRelativeTime.ts'

const now = 1_000_000_000_000

test('a duration that rounds up to the next unit uses that unit', () => {
  expect(formatRelativeTime(now - 59_600, now)).toBe('1 minute ago')
  expect(formatRelativeTime(now - 59_400, now)).toBe('59 seconds ago')
  expect(formatRelativeTime(now + 59_600, now)).toBe('in 1 minute')
  expect(formatRelativeTime(now - 59.6 * 60_000, now)).toBe('1 hour ago')
})
