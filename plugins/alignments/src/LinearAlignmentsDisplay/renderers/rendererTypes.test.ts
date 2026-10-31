import { interbaseRangeEnds } from '../../shared/uploadTypes.ts'
import { pileupCellWidth } from './rendererTypes.ts'

// Contiguous base walls take a half-pixel overdraw to close Canvas2D
// anti-aliasing seams; sparse marks don't.
describe('pileup cell width', () => {
  it('floors at 1px when zoomed out past 1 bp/px', () => {
    expect(pileupCellWidth(4, false)).toBe(1)
    expect(pileupCellWidth(4, true)).toBe(1.5)
  })

  it('tracks pixels-per-bp when zoomed in', () => {
    expect(pileupCellWidth(0.25, false)).toBe(4)
    expect(pileupCellWidth(0.25, true)).toBe(4.5)
  })

  it('adds exactly the seam fudge for contiguous walls', () => {
    for (const bpPerPx of [0.1, 0.5, 1, 2]) {
      expect(
        pileupCellWidth(bpPerPx, true) - pileupCellWidth(bpPerPx, false),
      ).toBeCloseTo(0.5)
    }
  })
})

describe('interbaseRangeEnds', () => {
  it('computes cumulative ends', () => {
    const { insEnd, scEnd, hcEnd } = interbaseRangeEnds({
      numInsertions: 3,
      numSoftclips: 5,
      numHardclips: 2,
    })
    expect(insEnd).toBe(3)
    expect(scEnd).toBe(8)
    expect(hcEnd).toBe(10)
  })

  it('handles zeros', () => {
    const { insEnd, scEnd, hcEnd } = interbaseRangeEnds({
      numInsertions: 0,
      numSoftclips: 0,
      numHardclips: 0,
    })
    expect(insEnd).toBe(0)
    expect(scEnd).toBe(0)
    expect(hcEnd).toBe(0)
  })
})
