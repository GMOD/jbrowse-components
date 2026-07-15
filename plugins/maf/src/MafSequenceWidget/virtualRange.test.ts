import { virtualRange } from './virtualRange.ts'

test('window at scroll origin includes leading overscan clamped to 0', () => {
  expect(
    virtualRange({
      scroll: 0,
      cellSize: 10,
      viewport: 100,
      overscan: 3,
      total: 1000,
    }),
  ).toEqual({ start: 0, end: 16 })
})

test('scrolled window offsets start by overscan and stays cell-aligned', () => {
  // floor(250/10) - 3 = 22; visible = ceil(100/10) + 6 = 16
  expect(
    virtualRange({
      scroll: 250,
      cellSize: 10,
      viewport: 100,
      overscan: 3,
      total: 1000,
    }),
  ).toEqual({ start: 22, end: 38 })
})

test('sub-cell scroll does not change the window', () => {
  const a = virtualRange({
    scroll: 250,
    cellSize: 10,
    viewport: 100,
    overscan: 3,
    total: 1000,
  })
  const b = virtualRange({
    scroll: 257,
    cellSize: 10,
    viewport: 100,
    overscan: 3,
    total: 1000,
  })
  expect(a).toEqual(b)
})

test('end clamps to total near the tail', () => {
  // floor(9400/10) - 3 = 937; 937 + 16 = 953, clamped to total 950
  expect(
    virtualRange({
      scroll: 9400,
      cellSize: 10,
      viewport: 100,
      overscan: 3,
      total: 950,
    }),
  ).toEqual({ start: 937, end: 950 })
})
