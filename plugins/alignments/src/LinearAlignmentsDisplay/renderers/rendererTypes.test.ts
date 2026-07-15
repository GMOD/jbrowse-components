import { pileupCellWidth } from './rendererTypes.ts'

// The 1bp-cell Canvas2D painters (mismatch, modification, per-base
// quality/letter, soft-clip bases) all size their rects through pileupCellWidth
// so the seam-fudge rule can't drift between them. Contiguous base walls take a
// half-pixel overdraw to close Canvas2D anti-aliasing seams; sparse marks don't.
describe('pileupCellWidth', () => {
  it('floors at 1px when zoomed out past 1 bp/px', () => {
    expect(pileupCellWidth(4, false)).toBe(1)
    // Contiguous walls still take the fudge on top of the floor.
    expect(pileupCellWidth(4, true)).toBe(1.5)
  })

  it('tracks pixels-per-bp when zoomed in', () => {
    // bpPerPx 0.25 → 4 px/bp
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
