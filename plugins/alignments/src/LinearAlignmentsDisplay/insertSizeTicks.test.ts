import { computeInsertSizeTicks } from './insertSizeTicks.ts'
import { ARC_BAND_INSET_PX as INSET } from './renderers/arcMarks.ts'

// The height the log scale runs over: the band less the inset at each end.
const plotH = (height: number) => height - 2 * INSET

describe('computeInsertSizeTicks', () => {
  it('returns undefined when available height is invalid', () => {
    expect(
      computeInsertSizeTicks({
        arcsYDomainBp: 100,
        band: { top: 0, height: 2 * INSET, down: true },
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

  // The log baseline tick (value 1) sits an inset from the edge the band hangs
  // from, and the full-domain tick an inset from the other: the scale the
  // bars and their squares plot on (`arcBandYScale`).
  it('anchors the baseline tick at the band edge the bars rise from', () => {
    const arcsYDomainBp = 1000
    const down = computeInsertSizeTicks({
      arcsYDomainBp,
      band: { top: 45, height: 40, down: true },
    })!
    // down mode: baseline at the band top (45), the domain max below it
    expect(down.items[0]!.value).toBe(1)
    expect(down.items[0]!.y).toBeCloseTo(45 + INSET)
    expect(down.items.at(-1)!.value).toBe(arcsYDomainBp)
    expect(down.items.at(-1)!.y).toBeCloseTo(45 + 40 - INSET)
    expect(down.yTop).toBeCloseTo(45 + INSET)
    expect(down.yBottom).toBeCloseTo(45 + 40 - INSET)

    const up = computeInsertSizeTicks({
      arcsYDomainBp,
      band: { top: 0, height: 45, down: false },
    })!
    // up mode: baseline at the band bottom (45), the domain max above it
    expect(up.items[0]!.y).toBeCloseTo(45 - INSET)
    expect(up.yBottom).toBeCloseTo(45 - INSET)
    expect(up.yTop).toBeCloseTo(INSET)
  })

  it('carries the domain reversed in down mode', () => {
    const arcsYDomainBp = 1000
    const availH = plotH(40)
    const down = computeInsertSizeTicks({
      arcsYDomainBp,
      band: { top: 45, height: 40, down: true },
    })!
    expect(down.items[0]!.value).toBe(1)
    expect(down.items[0]!.y).toBe(down.yTop)
    expect(down.items.at(-1)!.value).toBe(arcsYDomainBp)
    expect(down.items.at(-1)!.y).toBeCloseTo(down.yBottom)
    expect(down.yBottom - down.yTop).toBeCloseTo(availH)

    const up = computeInsertSizeTicks({
      arcsYDomainBp,
      band: { top: 45, height: 40, down: false },
    })!
    expect(up.items[0]!.y).toBe(up.yBottom)
    expect(up.items.at(-1)!.y).toBeCloseTo(up.yTop)
  })

  // Ticks are base-2 log-positioned, not linear: at domain 1000 the value-100
  // tick sits at log2(100)/log2(1000) ≈ 0.666 of the band, far from the linear
  // 0.1 it would occupy. (Tall band so the 100 decade survives tick-thinning.)
  it('positions ticks on a log scale', () => {
    const arcsYDomainBp = 1000
    const availH = plotH(200)
    const r = computeInsertSizeTicks({
      arcsYDomainBp,
      band: { top: 0, height: 200, down: true },
    })!
    const t100 = r.items.find(t => t.value === 100)!
    const at = (t100.y - INSET) / availH
    expect(at).toBeCloseTo(Math.log2(100) / Math.log2(1000), 5)
    expect(at).toBeGreaterThan(0.6)
  })

  // A short band (read-cloud TLEN) thins down to just the min + max ticks
  // instead of a dense unreadable ladder.
  it('thins to two ticks on a short band', () => {
    const r = computeInsertSizeTicks({
      arcsYDomainBp: 34000,
      band: { top: 0, height: 80, down: true },
    })!
    expect(r.items.length).toBe(2)
    expect(r.items[0]!.value).toBe(1)
    expect(r.items.at(-1)!.value).toBe(34000)
    // 33950→"34kb" rounding: the domain-max label has no fractional unit
    expect(r.items.at(-1)!.label).toBe('34kb')
  })

  // The domain max is real data, so it lands wherever the library's longest
  // insert put it — often just past a power of ten. On a LOG axis that is a
  // hair's width from the decade below it, and the thinning below cannot help:
  // it fires only when there are more decades than slots and it keeps exactly
  // the two that collide.
  describe('the domain-max tick does not land on top of the decade below it', () => {
    const tallBand = { top: 0, height: 208, down: true as const }
    const availH = plotH(208)

    it('drops the crowded decade, keeping the max', () => {
      // 1000 and 1005 sat 0.1px apart, printing "1kb" over "1.0kb".
      const r = computeInsertSizeTicks({
        arcsYDomainBp: 1005,
        band: tallBand,
      })!
      expect(r.items.map(t => t.value)).toEqual([1, 10, 100, 1005])
    })

    it('leaves a decade that is genuinely the max alone', () => {
      // Nothing is appended when the domain IS a power of ten, so there is
      // nothing crowding it — this is the case that must not lose its top tick.
      const r = computeInsertSizeTicks({
        arcsYDomainBp: 1000,
        band: tallBand,
      })!
      expect(r.items.map(t => t.value)).toEqual([1, 10, 100, 1000])
    })

    it('leaves a max with room below it alone', () => {
      // 33950 sits well clear of 10000 on a log axis, so both survive.
      const r = computeInsertSizeTicks({
        arcsYDomainBp: 34000,
        band: { top: 0, height: 400, down: true },
      })!
      expect(r.items.map(t => t.value)).toContain(10000)
      expect(r.items.at(-1)!.value).toBe(34000)
    })

    it('so every surviving pair clears the caller’s own tick budget', () => {
      // `maxTicks` is `availH / 30`, i.e. the caller's statement that a tick
      // needs 30px. The guard is spelled in that same currency, so the gap it
      // enforces is the gap the budget already promised.
      for (const domain of [1005, 10500, 12000, 33950, 1e6 + 1]) {
        const items = computeInsertSizeTicks({
          arcsYDomainBp: domain,
          band: tallBand,
        })!.items
        const gaps = items
          .slice(1)
          .map((t, i) => Math.abs(t.y - items[i]!.y))
          .filter(g => g > 0)
        // Epsilon because the two sides reach the same number by different
        // routes — the gap through `log2`, the budget through a division.
        expect(Math.min(...gaps)).toBeGreaterThan(availH / items.length - 0.01)
      }
    })
  })
})
