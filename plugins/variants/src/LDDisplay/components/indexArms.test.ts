import { indexArmColumns } from './indexArms.ts'

test('a full triangle runs the arms to the first and last column', () => {
  expect(indexArmColumns(5, 10, 9)).toEqual({ first: 0, last: 9 })
})

test('a banded file stops the arms at the widest pair it lists', () => {
  expect(indexArmColumns(5, 20, 3)).toEqual({ first: 2, last: 8 })
})

test('the arms stay inside the matrix near its edges', () => {
  expect(indexArmColumns(1, 20, 3)).toEqual({ first: 0, last: 4 })
  expect(indexArmColumns(18, 20, 3)).toEqual({ first: 15, last: 19 })
})

test('a file with no pairs draws no arms', () => {
  expect(indexArmColumns(5, 10, 0)).toEqual({ first: 5, last: 5 })
})
