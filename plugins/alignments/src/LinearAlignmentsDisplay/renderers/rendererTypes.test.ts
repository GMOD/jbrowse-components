import { makePileupCellMapper } from './rendererTypes.ts'

import type { DrawBlock } from './rendererTypes.ts'

// The 1bp-cell Canvas2D painters (mismatch, modification, per-base
// quality/letter, soft-clip bases) all size their rects through
// makePileupCellMapper so the seam-fudge rule can't drift between them.
// Contiguous base walls take a half-pixel overdraw to close Canvas2D
// anti-aliasing seams; sparse marks don't.
const BLOCK_WIDTH = 100
const block: DrawBlock = { start: 0, end: 0, screenStartPx: 0 }

// bpPerPx is bpLength/fullBlockWidth, so pin the width and vary bpLength.
function widthAt(bpPerPx: number, contiguous: boolean) {
  return makePileupCellMapper(
    block,
    bpPerPx * BLOCK_WIDTH,
    BLOCK_WIDTH,
    contiguous,
  ).w
}

describe('pileup cell width', () => {
  it('floors at 1px when zoomed out past 1 bp/px', () => {
    expect(widthAt(4, false)).toBe(1)
    // Contiguous walls still take the fudge on top of the floor.
    expect(widthAt(4, true)).toBe(1.5)
  })

  it('tracks pixels-per-bp when zoomed in', () => {
    // bpPerPx 0.25 → 4 px/bp
    expect(widthAt(0.25, false)).toBe(4)
    expect(widthAt(0.25, true)).toBe(4.5)
  })

  it('adds exactly the seam fudge for contiguous walls', () => {
    for (const bpPerPx of [0.1, 0.5, 1, 2]) {
      expect(widthAt(bpPerPx, true) - widthAt(bpPerPx, false)).toBeCloseTo(0.5)
    }
  })
})

// `bpToScreenX` is the cell's left edge only on a forward block; a reversed
// block runs bp leftward, putting it on the cell's right edge. cellX folds that
// pivot in so a painter's `fillRect(cellX(bp), y, w, h)` covers bp either way.
describe('makePileupCellMapper cellX', () => {
  // bp 100..110 across 100px => 10 px/bp. bp 100 owns [0,10] forward, and is
  // the rightmost base — owning [90,100] — reversed.
  const span: DrawBlock = { start: 100, end: 110, screenStartPx: 0 }
  const mapper = (reversed: boolean) =>
    makePileupCellMapper({ ...span, reversed }, 10, BLOCK_WIDTH, false)

  it('forward: cellX is the base cell left edge', () => {
    expect(mapper(false).cellX(100)).toBeCloseTo(0)
    expect(mapper(false).cellX(105)).toBeCloseTo(50)
  })

  it('reversed: cellX still lands on the left edge of that same base', () => {
    expect(mapper(true).cellX(100)).toBeCloseTo(90)
    expect(mapper(true).cellX(105)).toBeCloseTo(40)
  })

  it('respects screenStartPx offset', () => {
    const m = makePileupCellMapper(
      { ...span, screenStartPx: 20 },
      10,
      BLOCK_WIDTH,
      false,
    )
    expect(m.cellX(100)).toBeCloseTo(20)
  })
})
