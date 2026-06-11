import { computeInsertSizeTicks } from './insertSizeTicks.ts'
import { ARC_HEIGHT_MARGIN } from './shaders/palettes.ts'

describe('computeInsertSizeTicks', () => {
  it('returns undefined when available height is invalid', () => {
    expect(
      computeInsertSizeTicks({
        arcsYDomainBp: 100,
        band: { top: 0, height: ARC_HEIGHT_MARGIN, down: true },
      }),
    ).toBeUndefined()

    expect(
      computeInsertSizeTicks({
        arcsYDomainBp: 100,
        band: { top: 0, height: 0, down: true },
      }),
    ).toBeUndefined()
  })

  it('returns valid ticks when inputs are valid', () => {
    const result = computeInsertSizeTicks({
      arcsYDomainBp: 500,
      band: { top: 0, height: 40, down: true },
    })

    expect(result).toBeDefined()
    expect(result?.items.length).toBeGreaterThan(0)
    expect(result?.items.every(t => Number.isFinite(t.y))).toBe(true)
  })

  // The log baseline tick (value 1) sits at the arc anchor and the full-domain
  // tick sits at the apex (anchor ∓ availH), matching features/arcs/drawCanvas.ts
  // + arcYScale.ts exactly.
  it('anchors the baseline tick at the band edge the arcs anchor to', () => {
    const arcsYDomainBp = 1000
    const down = computeInsertSizeTicks({
      arcsYDomainBp,
      band: { top: 45, height: 40, down: true },
    })!
    const availH = 40 - ARC_HEIGHT_MARGIN
    // down mode: anchor at band top (45), apex below it. log2(1)=0 → baseline
    // tick at the anchor; the domain-max tick at the apex.
    expect(down.items[0]!.value).toBe(1)
    expect(down.items[0]!.y).toBe(45)
    expect(down.items.at(-1)!.value).toBe(arcsYDomainBp)
    expect(down.items.at(-1)!.y).toBeCloseTo(45 + availH)
    expect(down.yTop).toBe(45)
    expect(down.yBottom).toBe(45 + availH)

    const up = computeInsertSizeTicks({
      arcsYDomainBp,
      band: { top: 0, height: 45, down: false },
    })!
    const upAvailH = 45 - ARC_HEIGHT_MARGIN
    // up mode: anchor at band bottom (top + height = 45), apex above it
    expect(up.items[0]!.y).toBe(45)
    expect(up.yBottom).toBe(45)
    expect(up.yTop).toBe(45 - upAvailH)
  })

  // Ticks are base-2 log-positioned, not linear: at domain 1000 the value-100
  // tick sits at log2(100)/log2(1000) ≈ 0.666 of the band, far from the linear
  // 0.1 it would occupy.
  it('positions ticks on a log scale', () => {
    const arcsYDomainBp = 1000
    const availH = 40 - ARC_HEIGHT_MARGIN
    const r = computeInsertSizeTicks({
      arcsYDomainBp,
      band: { top: 0, height: 40, down: true },
    })!
    const t100 = r.items.find(t => t.value === 100)!
    expect(t100.y / availH).toBeCloseTo(Math.log2(100) / Math.log2(1000), 5)
    expect(t100.y / availH).toBeGreaterThan(0.6)
  })
})
