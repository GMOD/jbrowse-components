import { describeMafStatus, toMafStatus } from './mafStatus.ts'

test('toMafStatus accepts known chars, rejects others', () => {
  expect(toMafStatus('C')).toBe('C')
  expect(toMafStatus('n')).toBe('n')
  expect(toMafStatus('x')).toBeUndefined()
  expect(toMafStatus('')).toBeUndefined()
  expect(toMafStatus(undefined)).toBeUndefined()
})

test('describeMafStatus phrases each status', () => {
  expect(describeMafStatus('C')).toBe('contiguous')
  expect(describeMafStatus('M')).toBe('missing data (Ns)')
  expect(describeMafStatus('T')).toBe('tandem duplication')
})
