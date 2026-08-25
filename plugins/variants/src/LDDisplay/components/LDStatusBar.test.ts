import { ldStatusParts } from './LDStatusBar.tsx'

import type { FilterStats } from '../../VariantRPC/getLDMatrix.ts'
import type { LDStatusSelf } from './LDStatusBar.tsx'

const CLEAN: FilterStats = {
  totalVariants: 812,
  passedVariants: 812,
  filteredByMaf: 0,
  filteredByLength: 0,
  filteredByMultiallelic: 0,
  filteredByHwe: 0,
  filteredByCallRate: 0,
  filteredByJexl: 0,
}

function makeSelf(overrides: Partial<LDStatusSelf> = {}): LDStatusSelf {
  return {
    filterStats: CLEAN,
    isPrecomputedLD: false,
    ldMethod: 'composite',
    loadedLDWindow: undefined,
    ...overrides,
  }
}

test('the unwindowed VCF bar is counts plus the estimator', () => {
  expect(ldStatusParts(makeSelf())).toEqual([
    '812 / 812 variants shown',
    'LD: composite (Weir)',
  ])
})

// `maxVariantSeparation` decides which pairs exist at all, and the plot cannot
// show that: an undrawn out-of-band cell leaves the background, and an in-band
// r² = 0 is the ramp's white end at full alpha, which against a light theme is
// the same pixel. Long-range LD is the case worth looking for, and without this
// line it reads as absent rather than as never measured.
test('a windowed matrix says how far apart a computed pair may be', () => {
  expect(ldStatusParts(makeSelf({ loadedLDWindow: 500 }))).toEqual([
    '812 / 812 variants shown',
    'LD: composite (Weir)',
    'pairs up to 500 variants apart',
  ])
})

// The window is the one thing a PLINK matrix and a VCF matrix share here:
// `resolveBand` applies to both, and `getLDMatrixFromPlink` drops a record for
// a pair outside it. Before this the bar was suppressed outright for those
// adapters, so a windowed pre-computed track said nothing at all.
test('a pre-computed matrix reports its window and nothing else', () => {
  expect(
    ldStatusParts(makeSelf({ isPrecomputedLD: true, ldMethod: 'precomputed' })),
  ).toEqual([])
  expect(
    ldStatusParts(
      makeSelf({
        isPrecomputedLD: true,
        ldMethod: 'precomputed',
        loadedLDWindow: 250,
      }),
    ),
  ).toEqual(['pairs up to 250 variants apart'])
})

// The label names the estimator. 'composite' is honoured on a phased callset,
// so calling the data unphased here was false the moment the `ldMethod` slot
// landed.
test('the estimator label does not describe the data as unphased', () => {
  expect(ldStatusParts(makeSelf()).join(' ')).not.toMatch(/unphased/i)
  expect(ldStatusParts(makeSelf({ ldMethod: 'phased' }))).toContain(
    'LD: phased haplotypes (exact)',
  )
})

test('dropped variants are itemized', () => {
  expect(
    ldStatusParts(
      makeSelf({
        filterStats: {
          ...CLEAN,
          passedVariants: 700,
          filteredByMaf: 112,
        },
      }),
    )[0],
  ).toBe('700 / 812 variants shown (112 MAF)')
})
