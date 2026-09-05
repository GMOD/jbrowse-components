// Why every bp→x snap in the tree is `floor(x + 0.5)` and must stay a rule of
// that shape, written down because the alternative looks like a free fix and is
// not.
//
// The tree ships two orders for the same reversed block. The negated pivot
// (`bpRangeXTuple` negates the span length, so the projection mirrors and the
// snap comes after) and the final mirror (alignments' `flipX` snaps in a
// monotone frame and mirrors the finished quad) place a base edge one whole
// pixel apart wherever the projection lands on an exact half — 19 of 41 base
// edges at 2.5 px/bp, 32 of 65 at 1.5. Round-half-to-even removes that: it is
// symmetric under `px ↦ W - px`, so the two orders agree exactly on an
// even-width viewport.
//
// It also breaks the base grid, and that is the trade this file exists to
// record. The two properties are not both available:
//
//   - SPACING, `snap(x + 1) === snap(x) + 1`. What makes 1bp cells tile at one
//     uniform width. Every per-base painter depends on it — the pileup's five
//     cell layers, MAF's alignment cells, the reference sequence.
//   - MIRROR, `W - snap(x) === snap(W - x)` for integer `W`. What makes the two
//     reversal orders agree.
//
// Spacing forces `snap(x) = floor(x) + g(frac x)` with `g` into {0, 1}; mirror
// forces `g(f) + g(1 - f) === 1`, which at `f = 0.5` reads `2·g(0.5) === 1`.
// No integer `g` satisfies it, and the sweep below enumerates the choice to show
// nothing escapes. So the snap can tile the genome or it can commute with
// reversal, never both, and a genome browser has to tile: an alternating 2-0-2-0
// base grid is visible on every read at 1 px/bp, while the mirror disagreement
// is one column between two plugins that use different reversal orders.
import { rectSpanPx } from '../passes/shaders/rect.js.generated.ts'

// The shipped snap, reached through real generated code rather than restated:
// a span's left edge is `rectSpanPx`'s unwidened first component.
const shippedSnap = (x: number) => rectSpanPx(x, x + 1000, false)[0]

const roundHalfEven = (x: number) => {
  const f = Math.floor(x)
  const frac = x - f
  const odd = f - 2 * Math.floor(f * 0.5)
  return frac > 0.5 ? f + 1 : frac < 0.5 ? f : f + odd
}

const HALVES = Array.from({ length: 400 }, (_, i) => (i - 200) / 2)
const VIEWPORT_PX = 100

const spacingFailures = (snap: (x: number) => number) =>
  HALVES.filter(x => snap(x + 1) !== snap(x) + 1)

const mirrorFailures = (snap: (x: number) => number) =>
  HALVES.filter(x => VIEWPORT_PX - snap(x) !== snap(VIEWPORT_PX - x))

describe('the bp→x pixel snap', () => {
  it('tiles: a 1bp cell is the same width wherever the block starts', () => {
    expect(spacingFailures(shippedSnap)).toEqual([])
    // The concrete artifact, at 1 px/bp on a block starting mid-pixel — the
    // case that decides this, since it is every read in a pileup at base zoom.
    const widths = (snap: (x: number) => number) =>
      Array.from({ length: 6 }, (_, b) => snap(10.5 + b + 1) - snap(10.5 + b))
    expect(widths(shippedSnap)).toEqual([1, 1, 1, 1, 1, 1])
    expect(widths(roundHalfEven)).toEqual([2, 0, 2, 0, 2, 0])
  })

  it('and therefore does not commute with reversal, only at exact halves', () => {
    // Every failure is a tie; nothing else disagrees.
    const bad = mirrorFailures(shippedSnap)
    expect(bad).not.toEqual([])
    expect(bad.every(x => x - Math.floor(x) === 0.5)).toBe(true)
  })

  it('has no third option: spacing and mirror are exclusive at a tie', () => {
    // Spacing pins the rule to `floor(x) + g(frac)`, so the only freedom left is
    // g at the tie. Both choices fail the mirror, and the rule that passes the
    // mirror fails spacing.
    for (const gHalf of [0, 1]) {
      const snap = (x: number) => {
        const f = Math.floor(x)
        const frac = x - f
        return f + (frac > 0.5 ? 1 : frac < 0.5 ? 0 : gHalf)
      }
      expect(spacingFailures(snap)).toEqual([])
      expect(mirrorFailures(snap)).not.toEqual([])
    }
    expect(mirrorFailures(roundHalfEven)).toEqual([])
    expect(spacingFailures(roundHalfEven)).not.toEqual([])
  })
})
