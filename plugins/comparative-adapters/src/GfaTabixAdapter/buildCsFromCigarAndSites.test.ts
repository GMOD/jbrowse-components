import { buildCsFromCigarAndSites } from './bubbleOverlay.ts'

import type { BubbleSite } from './bubbleOverlay.ts'

// Helper to construct a single biallelic site for tests: alleleA=0, alleleB=1,
// genome 0 → allele 0 (ref), genome 1 → allele 1 (query).
function biallelicSite(
  start: number,
  end: number,
  cs: string,
  identity: number,
): BubbleSite {
  return {
    start,
    end,
    alleleByGenome: new Map([
      [0, 0],
      [1, 1],
    ]),
    pairs: new Map([['0-1', { cs, identity }]]),
  }
}

describe('buildCsFromCigarAndSites', () => {
  it('emits length-only `-` ops for CIGAR D so deletions stay visible', () => {
    // Sample3 from volvox_indel_pangenome.gfa has a 154 bp deletion that the
    // segment walk encodes as `100=154D100I301=`. Without CIGAR awareness the
    // bubble walk produced `:555` and the deletion vanished.
    const feat = { start: 0, end: 555, cigar: '100=154D100I301=' }
    // Sentinel site outside the feature; helper should short-circuit.
    const sites = [biallelicSite(600, 601, '*ac', 1)]
    const result = buildCsFromCigarAndSites(feat, sites, 0, 1, 0)

    expect(result.cs.startsWith(':100')).toBe(true)
    expect(result.cs).toMatch(/-n{154}/)
    expect(result.cs).toMatch(/\+n{100}/)
    expect(result.cs.endsWith(':301')).toBe(true)
    // Identity denom = ref-consuming ops only: 100 (=) + 154 (D) + 301 (=).
    expect(result.identityTotalBp).toBe(555)
    // Match num = matched runs only (D and I contribute 0).
    expect(result.identityMatchBp).toBe(401)
  })

  it('inlines bubble pair CS within a matched run', () => {
    const feat = { start: 0, end: 200, cigar: '200=' }
    const sites = [biallelicSite(50, 60, '*ac:8*ag', 0.9)]
    const result = buildCsFromCigarAndSites(feat, sites, 0, 1, 0)

    expect(result.cs).toBe(':50*ac:8*ag:140')
    expect(result.identityTotalBp).toBe(200)
    // Match: 50 leading + 0.9*10 site + 140 trailing = 199.
    expect(result.identityMatchBp).toBeCloseTo(199, 5)
  })

  it('falls back to ref-span walk when CIGAR is missing', () => {
    const feat = { start: 0, end: 100, cigar: undefined }
    const result = buildCsFromCigarAndSites(feat, [], 0, 1, 0)
    expect(result.cs).toBe(':100')
    expect(result.identityTotalBp).toBe(100)
    expect(result.identityMatchBp).toBe(100)
  })

  it('treats X like = so bubble pair CS overlays alt-allele SNVs', () => {
    // 1bp segment swap → X. Bubble VCF supplies the actual *xy substitution.
    const feat = { start: 0, end: 100, cigar: '50=1X49=' }
    const sites = [biallelicSite(50, 51, '*ag', 0)]
    const result = buildCsFromCigarAndSites(feat, sites, 0, 1, 0)

    expect(result.cs).toBe(':50*ag:49')
    expect(result.identityTotalBp).toBe(100)
    // Match: 50 (=) + 0 (mismatch) + 49 (=) = 99.
    expect(result.identityMatchBp).toBe(99)
  })

  it('falls back to :N for X runs without bubble coverage', () => {
    const feat = { start: 0, end: 100, cigar: '50=1X49=' }
    const result = buildCsFromCigarAndSites(feat, [], 0, 1, 0)
    expect(result.cs).toBe(':50:1:49')
    expect(result.identityTotalBp).toBe(100)
    expect(result.identityMatchBp).toBe(100)
  })

  it('skips sites that straddle a matched-run boundary', () => {
    // Run is 100=80D, so the matched portion is [0,100). A site spanning
    // [90, 130) crosses into the deleted region — apply :gap, not its CS.
    const feat = { start: 0, end: 180, cigar: '100=80D' }
    const sites = [biallelicSite(90, 130, '*ac:38*ag', 0.5)]
    const result = buildCsFromCigarAndSites(feat, sites, 0, 1, 0)
    expect(result.cs).toBe(`:100-${'n'.repeat(80)}`)
  })
})
