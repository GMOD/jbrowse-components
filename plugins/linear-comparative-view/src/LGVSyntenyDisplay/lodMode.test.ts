import { resolveDisplayLodMode } from './lodMode.ts'

test('an adapter with no coarse tier gets no lodMode at all', () => {
  expect(
    resolveDisplayLodMode({
      bpPerPx: 100000,
      coarseBpPerPxThreshold: undefined,
    }),
  ).toBeUndefined()
})

test('zoomed out past the threshold asks for the coarse tier', () => {
  expect(
    resolveDisplayLodMode({ bpPerPx: 20000, coarseBpPerPxThreshold: 10000 }),
  ).toBe('coarse')
})

test('zoomed in asks for the fine tier', () => {
  expect(
    resolveDisplayLodMode({ bpPerPx: 10, coarseBpPerPxThreshold: 10000 }),
  ).toBe('fine')
})

// the boundary is inclusive, matching the adapter's own `bpPerPx >= threshold`
test('exactly at the threshold is coarse', () => {
  expect(
    resolveDisplayLodMode({ bpPerPx: 10000, coarseBpPerPxThreshold: 10000 }),
  ).toBe('coarse')
})

// the point of resolving here rather than forwarding bpPerPx: this value is part
// of the refetch cache key, so it must be stable across zoom steps that don't
// cross the threshold
test('zoom steps on the same side of the threshold give an identical answer', () => {
  const at = (bpPerPx: number) =>
    resolveDisplayLodMode({ bpPerPx, coarseBpPerPxThreshold: 10000 })
  expect([at(1), at(10), at(100), at(1000)]).toEqual([
    'fine',
    'fine',
    'fine',
    'fine',
  ])
  expect([at(10000), at(100000), at(1000000)]).toEqual([
    'coarse',
    'coarse',
    'coarse',
  ])
})
