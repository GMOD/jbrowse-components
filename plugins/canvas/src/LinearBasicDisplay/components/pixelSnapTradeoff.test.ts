// A bp→x snap can tile the genome — `snap(x + 1) === snap(x) + 1`, which is what
// makes 1bp cells one uniform width — or it can commute with reversal, never
// both. A browser has to tile: the alternating 2-0-2-0 base grid shows on every
// read at 1 px/bp, while the mirror disagreement is one column.
import { rectSpanPx } from '../passes/shaders/rect.js.generated.ts'

// Reached through the shipped generated code rather than restated here.
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
    // 1 px/bp on a block starting mid-pixel is the deciding case: every read in
    // a pileup at base zoom.
    const widths = (snap: (x: number) => number) =>
      Array.from({ length: 6 }, (_, b) => snap(10.5 + b + 1) - snap(10.5 + b))
    expect(widths(shippedSnap)).toEqual([1, 1, 1, 1, 1, 1])
    expect(widths(roundHalfEven)).toEqual([2, 0, 2, 0, 2, 0])
  })

  it('and therefore does not commute with reversal, only at exact halves', () => {
    const bad = mirrorFailures(shippedSnap)
    expect(bad).not.toEqual([])
    expect(bad.every(x => x - Math.floor(x) === 0.5)).toBe(true)
  })

  it('has no third option: spacing and mirror are exclusive at a tie', () => {
    // Spacing pins the rule to `floor(x) + g(frac)`, leaving g at the tie as the
    // only freedom.
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
