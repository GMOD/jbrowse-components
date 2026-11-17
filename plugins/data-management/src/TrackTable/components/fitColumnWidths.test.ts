import { fitColumnWidths } from './fitColumnWidths.ts'

test('room left once every column fits goes to the first column', () => {
  expect(
    fitColumnWidths({ name: 200, type: 90, adapter: 110 }, 500, () => 100),
  ).toEqual({ name: 300, type: 90, adapter: 110 })
})

test('the room past each floor is shared by how much more a column wants', () => {
  // floors 100 + 100 + 100 + 95 = 395, so 247 px is shared among the 448 px
  // the name and adapter columns want past their floors
  const fitted = fitColumnWidths(
    { name: 448, category: 100, adapter: 200, type: 95 },
    642,
    () => 100,
  )
  expect(fitted).toEqual({ name: 291, category: 100, adapter: 155, type: 95 })
  expect(Object.values(fitted).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(
    642,
  )
})

test('columns no wider than the floor are never shrunk', () => {
  expect(fitColumnWidths({ a: 300, b: 60 }, 120, () => 100)).toEqual({
    a: 100,
    b: 60,
  })
})

test('a column with a higher floor keeps that much before the rest share', () => {
  expect(
    fitColumnWidths({ name: 300, kind: 200, category: 200 }, 400, id =>
      id === 'name' ? 200 : 80,
    ),
  ).toEqual({ name: 211, kind: 94, category: 94 })
})
