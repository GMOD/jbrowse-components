import { showsHeaderLabels } from './headerLabels.ts'

test('an unmeasured bar keeps the labels', () => {
  expect(showsHeaderLabels({ width: undefined, searchRows: 3 })).toBe(true)
})

test('a hidden search strip leaves room at any usable width', () => {
  expect(showsHeaderLabels({ width: 400, searchRows: 0 })).toBe(true)
  expect(showsHeaderLabels({ width: 300, searchRows: 0 })).toBe(false)
})

test('the threshold follows the number of search boxes', () => {
  expect(showsHeaderLabels({ width: 700, searchRows: 2 })).toBe(false)
  expect(showsHeaderLabels({ width: 900, searchRows: 2 })).toBe(true)
  expect(showsHeaderLabels({ width: 900, searchRows: 3 })).toBe(false)
  expect(showsHeaderLabels({ width: 1200, searchRows: 3 })).toBe(true)
})

test('a stacked strip asks for one row however many there are', () => {
  expect(showsHeaderLabels({ width: 700, searchRows: 1 })).toBe(true)
})
