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

// The point of anchoring `end` to `start`: consumers skip work on scroll events
// that don't move the window, so this stability is load-bearing, not incidental.
test('sub-cell scroll does not change the window', () => {
  const args = { cellSize: 10, viewport: 100, overscan: 3, total: 1000 }
  expect(virtualRange({ ...args, scroll: 250 })).toEqual(
    virtualRange({ ...args, scroll: 257 }),
  )
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

// A shrunk list under a container that kept its scroll position. Without the
// `start` clamp this returned {start: 937, end: 5} — consumers size a canvas
// from `(end - start) * cellSize` and got a negative height, so the grid went
// blank until the next scroll event.
test('a total that shrinks below the scroll position yields an empty, non-inverted window', () => {
  const { start, end } = virtualRange({
    scroll: 9400,
    cellSize: 10,
    viewport: 100,
    overscan: 3,
    total: 5,
  })
  expect(start).toBeLessThanOrEqual(end)
  expect({ start, end }).toEqual({ start: 5, end: 5 })
})

test('a window wider than the list covers all of it', () => {
  expect(
    virtualRange({
      scroll: 0,
      cellSize: 10,
      viewport: 1000,
      overscan: 20,
      total: 7,
    }),
  ).toEqual({ start: 0, end: 7 })
})
