import { MIN_PANE_PX, pairSpan, withBoundaryAt } from './splitter.ts'

// shares are divided and multiplied on the way through, so compare them the way
// every other size assertion in this directory does
const rounded = (sizes: number[]) => sizes.map(n => Number(n.toFixed(6)))

// Sizes are shares of a branch, renormalised to sum to 1 — so a three-pane row
// at [0.5, 0.25, 0.25] has two boundaries, and the one before index 1 divides
// the 0.75 that panes 0 and 1 hold between them.
const three = [0.5, 0.25, 0.25]

test('the pair is the two panes either side of the boundary', () => {
  expect(pairSpan(three, 1)).toBeCloseTo(0.75)
  expect(pairSpan(three, 2)).toBeCloseTo(0.5)
})

// The point of a splitter: only the two panes it sits between change. "Just
// scale everything" is the version that gets this wrong.
test('every other pane holds still', () => {
  const next = withBoundaryAt(three, 1, 0.25)
  expect(rounded(next)).toEqual([0.25, 0.5, 0.25])
  expect(next[2]).toBe(three[2])
  expect(next.reduce((a, b) => a + b, 0)).toBeCloseTo(1)
})

test('the boundary lands where it is put', () => {
  expect(rounded(withBoundaryAt([0.5, 0.5], 1, 0.7))).toEqual([0.7, 0.3])
})

// Without a measured pair there is nothing to convert MIN_PANE_PX against, so
// the clamp is the plain one. jsdom takes this path — every rect is zero — which
// is why the constraint below is tested here and not through a rendered handle.
describe('unmeasured, the clamp is the pair itself', () => {
  test('a pane can go to nothing but not through it', () => {
    expect(rounded(withBoundaryAt([0.5, 0.5], 1, -3))).toEqual([0, 1])
    expect(rounded(withBoundaryAt([0.5, 0.5], 1, 9))).toEqual([1, 0])
  })
})

// dockview clamped a group at 100px in both directions, and a flex share of
// zero is legal — so without this a pane can be dragged, or Home'd, to nothing:
// the cell vanishes with its tab strip and its views, and what is left to grab
// it back with is a 4px sash flush against its neighbour.
describe('a measured pair keeps both panes above MIN_PANE_PX', () => {
  // the pair is the whole 1000px-wide row, so the 100px minimum is a tenth
  const wide = (position: number) =>
    rounded(withBoundaryAt([0.5, 0.5], 1, position, 1000))
  const min = MIN_PANE_PX / 1000

  test('dragging to the left edge stops at the minimum', () => {
    expect(wide(0)).toEqual([min, 1 - min])
  })

  test('dragging to the right edge stops at the minimum', () => {
    expect(wide(1)).toEqual([1 - min, min])
  })

  test('a position inside the range is untouched', () => {
    expect(wide(0.3)).toEqual([0.3, 0.7])
  })

  // the minimum is a share of the PAIR, so a boundary between two narrow panes
  // in a wide row is constrained by those two panes and not by the row
  test('the minimum is measured against the pair, not the window', () => {
    // panes 1 and 2 hold half of a 1000px row, so their pair is 500px and the
    // 100px minimum is a fifth of it
    const next = withBoundaryAt([0.5, 0.25, 0.25], 2, 0, 500)
    expect(next[1]).toBeCloseTo(0.1)
    expect(next[2]).toBeCloseTo(0.4)
    expect(next[0]).toBe(0.5)
  })

  // both minimums cannot fit, so the boundary stops in the middle — the only
  // answer that leaves both panes visible rather than pinning them past
  // each other
  test('a pair too small for two minimums splits the difference', () => {
    expect(rounded(withBoundaryAt([0.5, 0.5], 1, 0, 150))).toEqual([0.5, 0.5])
    expect(rounded(withBoundaryAt([0.5, 0.5], 1, 1, 150))).toEqual([0.5, 0.5])
  })
})
