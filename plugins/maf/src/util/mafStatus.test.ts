import { describeMafStatus, toMafStatus } from './mafStatus.ts'

test('toMafStatus accepts known chars, rejects others', () => {
  expect(toMafStatus('C')).toBe('C')
  expect(toMafStatus('n')).toBe('n')
  expect(toMafStatus('x')).toBeUndefined()
  expect(toMafStatus('')).toBeUndefined()
  expect(toMafStatus(undefined)).toBeUndefined()
})

test('describeMafStatus explains each status', () => {
  expect(describeMafStatus('C')).toMatch(/contiguous/)
  expect(describeMafStatus('n')).toMatch(/bridged/)
  expect(describeMafStatus('M')).toMatch(/Ns/)
  expect(describeMafStatus('T')).toMatch(/tandem duplication/)
})
