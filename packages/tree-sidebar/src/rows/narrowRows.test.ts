import { keptRows } from './narrowRows.ts'

test('keptRows returns the input array itself when unfiltered', () => {
  const rows = [{ name: 'mom' }, { name: 'dad' }, { name: 'kid' }]
  expect(keptRows(rows, undefined)).toBe(rows)
  expect(keptRows(rows, [])).toBe(rows)
})

test('keptRows keeps row order, not filter order', () => {
  const rows = [{ name: 'mom' }, { name: 'dad' }, { name: 'kid' }]
  expect(keptRows(rows, ['kid', 'mom'])).toEqual([
    { name: 'mom' },
    { name: 'kid' },
  ])
})

test('keptRows ignores filter names no row has', () => {
  const rows = [{ name: 'mom' }, { name: 'dad' }]
  expect(keptRows(rows, ['dad', 'ghost'])).toEqual([{ name: 'dad' }])
})
