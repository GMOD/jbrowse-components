import { formatLastModified } from './formatLastModified.ts'

const now = new Date('2026-06-10T12:00:00Z').getTime()

test('undefined timestamp', () => {
  const { label, tooltip } = formatLastModified(undefined, now)
  expect(label).toBe('Unknown')
  expect(tooltip).toBeUndefined()
})

test('recent session shows relative label, absolute tooltip', () => {
  const updated = now - 5 * 60 * 1000 // 5 minutes ago
  const { label, tooltip } = formatLastModified(updated, now)
  expect(label).toMatch(/ago$/)
  expect(tooltip).toBe(new Date(updated).toLocaleString('en-US'))
})

test('old session shows absolute label equal to tooltip', () => {
  const updated = now - 5 * 24 * 60 * 60 * 1000 // 5 days ago
  const { label, tooltip } = formatLastModified(updated, now)
  const absolute = new Date(updated).toLocaleString('en-US')
  expect(label).toBe(absolute)
  expect(tooltip).toBe(absolute)
})
