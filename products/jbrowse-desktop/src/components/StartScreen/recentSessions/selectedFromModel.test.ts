import { selectedFromModel } from './selectedFromModel.ts'

const sessions = [
  { path: '/a', name: 'a' },
  { path: '/b', name: 'b' },
  { path: '/c', name: 'c' },
]

test('include model selects the listed paths', () => {
  const model = { type: 'include' as const, ids: new Set(['/a', '/c']) }
  expect(selectedFromModel(model, sessions).map(s => s.path)).toEqual([
    '/a',
    '/c',
  ])
})

test('exclude model with no ids means everything (header select-all)', () => {
  const model = { type: 'exclude' as const, ids: new Set<string>() }
  expect(selectedFromModel(model, sessions).map(s => s.path)).toEqual([
    '/a',
    '/b',
    '/c',
  ])
})

test('exclude model selects everything except the excluded paths', () => {
  const model = { type: 'exclude' as const, ids: new Set(['/b']) }
  expect(selectedFromModel(model, sessions).map(s => s.path)).toEqual([
    '/a',
    '/c',
  ])
})
