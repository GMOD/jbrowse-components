import {
  MIN_FIT_ROWS,
  fitGroupMaxRows,
  nextGroupHeightOverride,
  reclaimFitRows,
} from './groupLayout.ts'

test('fitGroupMaxRows: splits the post-overhead height evenly across groups', () => {
  // 1000px height, 2 groups, 50px overhead each => (1000 - 100)/2 = 450px per
  // group / 10px rows = 45 rows.
  expect(
    fitGroupMaxRows({
      height: 1000,
      groupCount: 2,
      visibleGroupCount: 2,
      rowHeight: 10,
      overhead: 50,
      maxRows: 1000,
    }),
  ).toBe(45)
})

test('fitGroupMaxRows: never exceeds the display-wide cap', () => {
  expect(
    fitGroupMaxRows({
      height: 100000,
      groupCount: 2,
      visibleGroupCount: 2,
      rowHeight: 10,
      overhead: 0,
      maxRows: 30,
    }),
  ).toBe(30)
})

test('fitGroupMaxRows: floors to MIN_FIT_ROWS when the slice is tiny', () => {
  // Many groups / small viewport => slice goes negative; floor keeps a few rows
  // (the stack then overflows and scrolls).
  expect(
    fitGroupMaxRows({
      height: 200,
      groupCount: 8,
      visibleGroupCount: 8,
      rowHeight: 10,
      overhead: 45,
      maxRows: 1000,
    }),
  ).toBe(MIN_FIT_ROWS)
})

test('fitGroupMaxRows: a collapsed group hands its pileup slice to the rest', () => {
  // 3 groups all reserve 50px overhead (collapsed ones still show coverage), so
  // 1000 - 150 = 850px of pileup budget. With one group collapsed it divides
  // across the 2 still drawing => 425px / 10px = 42 rows (vs 283 -> 28 when all
  // three share it).
  expect(
    fitGroupMaxRows({
      height: 1000,
      groupCount: 3,
      visibleGroupCount: 3,
      rowHeight: 10,
      overhead: 50,
      maxRows: 1000,
    }),
  ).toBe(28)
  expect(
    fitGroupMaxRows({
      height: 1000,
      groupCount: 3,
      visibleGroupCount: 2,
      rowHeight: 10,
      overhead: 50,
      maxRows: 1000,
    }),
  ).toBe(42)
})

test('fitGroupMaxRows: all groups collapsed never divides by zero', () => {
  // No pileup is drawn, so the cap is irrelevant, but the math must stay finite.
  expect(
    fitGroupMaxRows({
      height: 1000,
      groupCount: 3,
      visibleGroupCount: 0,
      rowHeight: 10,
      overhead: 50,
      maxRows: 60,
    }),
  ).toBe(60)
})

test('reclaimFitRows: sparse groups donate unused rows to truncated ones', () => {
  // cap 45. Group a fit in 5 rows (40 spare), b in 15 (30 spare), c truncated.
  // 70 spare -> one recipient c -> cap 45 + 70 = 115.
  expect(
    reclaimFitRows({
      outcomes: [
        { key: 'a', usedRows: 5, truncated: false },
        { key: 'b', usedRows: 15, truncated: false },
        { key: 'c', usedRows: 45, truncated: true },
      ],
      defaultMaxRows: 45,
      maxRows: 1000,
    }),
  ).toEqual(new Map([['c', 115]]))
})

test('reclaimFitRows: spare splits evenly across multiple truncated groups', () => {
  // 60 spare from a, split across two truncated (b, c) => +30 each.
  expect(
    reclaimFitRows({
      outcomes: [
        { key: 'a', usedRows: 40, truncated: false },
        { key: 'b', usedRows: 100, truncated: true },
        { key: 'c', usedRows: 100, truncated: true },
      ],
      defaultMaxRows: 100,
      maxRows: 1000,
    }),
  ).toEqual(
    new Map([
      ['b', 130],
      ['c', 130],
    ]),
  )
})

test('reclaimFitRows: never raises a recipient past the global cap', () => {
  expect(
    reclaimFitRows({
      outcomes: [
        { key: 'a', usedRows: 0, truncated: false },
        { key: 'b', usedRows: 45, truncated: true },
      ],
      defaultMaxRows: 45,
      maxRows: 50,
    }),
  ).toEqual(new Map([['b', 50]]))
})

test('reclaimFitRows: no second pass when nothing can move', () => {
  // No truncated recipient.
  expect(
    reclaimFitRows({
      outcomes: [
        { key: 'a', usedRows: 5, truncated: false },
        { key: 'b', usedRows: 10, truncated: false },
      ],
      defaultMaxRows: 45,
      maxRows: 1000,
    }),
  ).toBeUndefined()
  // No spare (every group truncated).
  expect(
    reclaimFitRows({
      outcomes: [
        { key: 'a', usedRows: 45, truncated: true },
        { key: 'b', usedRows: 45, truncated: true },
      ],
      defaultMaxRows: 45,
      maxRows: 1000,
    }),
  ).toBeUndefined()
})

// rowHeight 20, displayed 100px (5 rows) throughout unless noted.
const drag = (o: Partial<Parameters<typeof nextGroupHeightOverride>[0]>) =>
  nextGroupHeightOverride({
    dy: 0,
    rowHeight: 20,
    displayedPx: 100,
    existingPx: undefined,
    fullyShown: false,
    ...o,
  })

test('nextGroupHeightOverride: fresh grow-drag on a fully-shown group banks nothing', () => {
  expect(drag({ dy: 5, fullyShown: true })).toBeUndefined()
})

test('nextGroupHeightOverride: fresh shrink seeds from the displayed height', () => {
  expect(drag({ dy: -5, fullyShown: true })).toBe(95)
  expect(drag({ dy: -5, fullyShown: false })).toBe(95)
})

test('nextGroupHeightOverride: grows a truncated group past its content', () => {
  expect(drag({ dy: 5, fullyShown: false })).toBe(105)
  expect(drag({ dy: 5, existingPx: 110, fullyShown: false })).toBe(115)
})

test('nextGroupHeightOverride: growing a fully-shown group pins at its content', () => {
  expect(drag({ dy: 5, existingPx: 110, fullyShown: true })).toBe(100)
})

test('nextGroupHeightOverride: floors at one row', () => {
  expect(drag({ dy: -500 })).toBe(20)
})

test('nextGroupHeightOverride: clamps a stale over-content override to one row of headroom', () => {
  // existing 500px runs well past the 100px content; base clamps to 100+20 so a
  // reversing (shrink) drag only walks back one row of dead space, not 400px.
  expect(drag({ dy: -5, existingPx: 500, fullyShown: true })).toBe(115)
})
