import { coerceColorBy } from './colorUtils.ts'

test('coerceColorBy passes through valid modes', () => {
  expect(coerceColorBy('strand')).toBe('strand')
  expect(coerceColorBy('meanQueryIdentity')).toBe('meanQueryIdentity')
})

test('coerceColorBy maps retired identityDiverging to identity', () => {
  expect(coerceColorBy('identityDiverging')).toBe('identity')
})

test('coerceColorBy falls back to default for unknown/undefined', () => {
  expect(coerceColorBy(undefined)).toBe('default')
  expect(coerceColorBy('bogus')).toBe('default')
})
