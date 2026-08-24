import { singularSlotName } from './singularSlotName.ts'

test('the array-typed slot names actually in tree', () => {
  expect(singularSlotName('displays')).toBe('display')
  expect(singularSlotName('tracks')).toBe('track')
  expect(singularSlotName('connections')).toBe('connection')
})

test('regular endings', () => {
  expect(singularSlotName('categories')).toBe('category')
  expect(singularSlotName('boxes')).toBe('box')
  expect(singularSlotName('matches')).toBe('match')
})

test('names that are already singular pass through', () => {
  expect(singularSlotName('adapter')).toBe('adapter')
  expect(singularSlotName('metadata')).toBe('metadata')
})

test('a trailing s that is not a plural is kept', () => {
  expect(singularSlotName('bias')).toBe('bias')
  expect(singularSlotName('alias')).toBe('alias')
  expect(singularSlotName('axis')).toBe('axis')
  expect(singularSlotName('status')).toBe('status')
  expect(singularSlotName('class')).toBe('class')
})
