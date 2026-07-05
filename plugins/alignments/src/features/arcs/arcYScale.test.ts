import { arcYFraction } from './arcYScale.ts'
import {
  arcColorPalette,
  linkedReadColorPalette,
} from '../../LinearAlignmentsDisplay/shaders/palettes.ts'
import { UNIFORM_SLOT_ARRAYS } from '../../LinearAlignmentsDisplay/shaders/slang/read.iface.generated.ts'

// The JS palettes (Canvas2D / SVG) and the GPU uniform slots are two hand-kept
// copies of the same color table. If they drift — a color constant added to one
// side but not the other — the GPU copy loop silently uploads a short palette
// and the Canvas2D `colorIdx % paletteLen` quietly wraps out-of-range indices,
// mis-coloring instead of failing. Pin the lengths equal so that drift is a
// test failure, not a subtle visual bug.
describe('arc palette parity (JS ↔ GPU uniform slots)', () => {
  it('arcColorPalette length matches the GPU arcColor slot count', () => {
    expect(arcColorPalette.length).toBe(UNIFORM_SLOT_ARRAYS.arcColor.length)
  })
  it('linkedReadColorPalette length matches the GPU linkedReadColor slot count', () => {
    expect(linkedReadColorPalette.length).toBe(
      UNIFORM_SLOT_ARRAYS.linkedReadColor.length,
    )
  })
})

// arcYFraction is the JS half of a formula whose other half lives in arc.slang's
// evalArcPoint (the GPU path) — they cannot import each other, so the two are
// kept in lockstep only by the "byte-identical" comment. These golden values
// pin the JS behavior so a change to it is visible and can be mirrored into the
// shader, and vice versa.
describe('arcYFraction', () => {
  describe('linear (arc mode)', () => {
    it('maps yBp as a plain fraction of the domain', () => {
      expect(arcYFraction(50, 200, false)).toBeCloseTo(0.25)
      expect(arcYFraction(200, 200, false)).toBeCloseTo(1)
    })
    it('returns 0 for a zero domain (no divide-by-zero)', () => {
      expect(arcYFraction(50, 0, false)).toBe(0)
    })
  })

  describe('log (samplot mode, base-2)', () => {
    it('spreads small inserts and normalizes the domain max to 1', () => {
      expect(arcYFraction(1, 1024, true)).toBeCloseTo(0) // log2(1)=0
      expect(arcYFraction(32, 1024, true)).toBeCloseTo(0.5) // log2(32)/log2(1024)=5/10
      expect(arcYFraction(1024, 1024, true)).toBeCloseTo(1)
    })
    it('clamps yBp below 1 to the baseline (log2 domain starts at 1)', () => {
      expect(arcYFraction(0, 1024, true)).toBeCloseTo(0)
    })
    it('clamps the domain below 2 so the denominator never collapses', () => {
      expect(arcYFraction(2, 1, true)).toBeCloseTo(1) // log2(2)/log2(2)
    })
  })
})
