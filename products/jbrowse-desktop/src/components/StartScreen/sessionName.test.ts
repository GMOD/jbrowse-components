import { resolveSessionName } from './sessionName.ts'

test('keeps an existing name unchanged (no timestamp re-appended on reopen)', () => {
  const name = 'New session 7/9/2026, 3:00:00 PM'
  expect(resolveSessionName({ name })).toBe(name)
})

test('does not grow the name across repeated loads', () => {
  const name = 'My analysis'
  const first = resolveSessionName({ name })
  const second = resolveSessionName({ name: first })
  expect(second).toBe(name)
})

test('synthesizes a name only when none is present', () => {
  expect(resolveSessionName({})).toMatch(/^New session /)
  expect(resolveSessionName({ name: '' })).toMatch(/^New session /)
})
