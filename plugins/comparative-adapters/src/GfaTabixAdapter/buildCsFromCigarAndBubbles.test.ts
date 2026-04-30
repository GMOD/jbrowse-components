import { buildCsFromCigarAndBubbles } from './gfaTabixUtils.ts'

interface BubbleRow {
  start: number
  end: number
  alleleA: number
  alleleB: number
  identity: number
  cs: string
  genomesA: Set<number>
  genomesB: Set<number>
}

// Most synteny features have no overlapping bubbles in the queried range; the
// adapter skips the per-feature build entirely in that case. These tests
// exercise the helper directly with a non-empty bubble list to cover the
// CIGAR-walking paths.

describe('buildCsFromCigarAndBubbles', () => {
  it('emits length-only `-` ops for CIGAR D so deletions stay visible', () => {
    // Sample3 from volvox_indel_pangenome.gfa has a 154 bp deletion that the
    // segment walk encodes as `100=154D100I301=`. Without CIGAR awareness the
    // bubble walk produced `:555` and the deletion vanished.
    const feat = {
      start: 0,
      end: 555,
      cigar: '100=154D100I301=',
    }
    // Single sentinel bubble outside the feature; helper short-circuits
    // before consuming bubbles inside `=` runs.
    const bubbles: BubbleRow[] = [
      {
        start: 600,
        end: 601,
        alleleA: 0,
        alleleB: 1,
        identity: 1,
        cs: '*ac',
        genomesA: new Set(),
        genomesB: new Set(),
      },
    ]
    const result = buildCsFromCigarAndBubbles(feat, bubbles, 0, 1, 0)

    expect(result.cs.startsWith(':100')).toBe(true)
    expect(result.cs).toMatch(/-n{154}/)
    expect(result.cs).toMatch(/\+n{100}/)
    expect(result.cs.endsWith(':301')).toBe(true)
    // Identity denominator includes ref-consuming ops only:
    // 100 (=) + 154 (D) + 301 (=) = 555. I doesn't consume ref.
    expect(result.identityTotalBp).toBe(555)
    // Match numerator: matched runs only. D contributes 0. I contributes 0.
    expect(result.identityMatchBp).toBe(401)
  })

  it('inlines bubble pair CS within a matched run', () => {
    // 200 bp matched run; one bubble at [50, 60] supplying *ac SNPs.
    const feat = {
      start: 0,
      end: 200,
      cigar: '200=',
    }
    const bubbles: BubbleRow[] = [
      {
        start: 50,
        end: 60,
        alleleA: 0,
        alleleB: 1,
        identity: 0.9,
        cs: '*ac:8*ag',
        genomesA: new Set([0]),
        genomesB: new Set([1]),
      },
    ]
    // gIdx=1 carries alleleB; refGenomeIdx=0 carries alleleA — straight CS.
    const result = buildCsFromCigarAndBubbles(feat, bubbles, 0, 1, 0)

    expect(result.cs).toBe(':50*ac:8*ag:140')
    expect(result.identityTotalBp).toBe(200)
    // Match: 50 leading gap + 0.9*10 bubble + 140 trailing = 199.
    expect(result.identityMatchBp).toBeCloseTo(199, 5)
  })

  it('falls back to ref-span walk when CIGAR is missing', () => {
    const feat = { start: 0, end: 100, cigar: undefined }
    const bubbles: BubbleRow[] = []
    const result = buildCsFromCigarAndBubbles(feat, bubbles, 0, 1, 0)
    expect(result.cs).toBe(':100')
    expect(result.identityTotalBp).toBe(100)
    expect(result.identityMatchBp).toBe(100)
  })

  it('skips bubbles that straddle a matched-run boundary', () => {
    // Run is 100=80D, so the matched portion is [0,100). A bubble spanning
    // [90, 130) crosses into the deleted region — apply :gap, not its CS.
    const feat = { start: 0, end: 180, cigar: '100=80D' }
    const bubbles: BubbleRow[] = [
      {
        start: 90,
        end: 130,
        alleleA: 0,
        alleleB: 1,
        identity: 0.5,
        cs: '*ac:38*ag',
        genomesA: new Set([0]),
        genomesB: new Set([1]),
      },
    ]
    const result = buildCsFromCigarAndBubbles(feat, bubbles, 0, 1, 0)
    expect(result.cs).toBe(`:100-${'n'.repeat(80)}`)
  })
})
