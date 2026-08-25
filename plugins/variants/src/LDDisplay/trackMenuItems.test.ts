import { buildLDTrackMenuItems } from './trackMenuItems.ts'

import type { LDMethod } from '../VariantRPC/getLDMatrix.ts'
import type { LDMenuSelf } from './trackMenuItems.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// The shape of the LD track menu, as opposed to what its items do. The builder
// takes a structural interface, so this needs no display instance: the stub
// below is what the model hands it, minus the node-ness only the two filter
// rows use (and only inside their onClick, which nothing here fires).
function makeSelf(overrides: Partial<LDMenuSelf> = {}) {
  const stub = {
    isPrecomputedLD: false,
    ldMethod: 'composite' as LDMethod,
    effectiveLdMetric: 'r2' as const,
    dprimeAvailable: true,
    focalSnpIndex: -1,
    signedLD: false,
    showLDTriangle: true,
    showLegend: false,
    showLegendDisplayTypeDefault: {
      slot: 'showLegend',
      onValue: false,
      active: false,
      toggle: () => {},
    },
    showLabels: false,
    showVerticalGuides: true,
    squashToHeight: false,
    useGenomicPositions: false,
    minorAlleleFrequencyFilter: 0.1,
    hweFilterThreshold: 0,
    callRateFilter: 0,
    configuredFilters: () => [],
    setFocalSnp: jest.fn(),
    setLDMetric: jest.fn(),
    setSignedLD: jest.fn(),
    setShowLDTriangle: jest.fn(),
    setShowLegend: jest.fn(),
    setShowLabels: jest.fn(),
    setShowVerticalGuides: jest.fn(),
    setSquashToHeight: jest.fn(),
    setUseGenomicPositions: jest.fn(),
    setMafFilter: jest.fn(),
    setHweFilter: jest.fn(),
    setCallRateFilter: jest.fn(),
    setJexlFilters: jest.fn(),
    ...overrides,
  }
  return stub as unknown as LDMenuSelf
}

function labelOf(item: MenuItem) {
  return 'label' in item ? item.label : undefined
}

function labels(items: MenuItem[]) {
  return items.map(labelOf)
}

function subMenuOf(items: MenuItem[], label: string) {
  const item = items.find(i => labelOf(i) === label)
  return item && 'subMenu' in item ? item.subMenu : undefined
}

test('the default menu is metric + show + filters', () => {
  // (1) on a freshly opened track is correct and is the point: the slot ships
  // at MAF 0.1, so a default LD display IS dropping variants, and until the
  // count existed nothing in the track chrome said so.
  expect(labels(buildLDTrackMenuItems(makeSelf()))).toEqual([
    'LD metric',
    'Show...',
    'Filter by... (1)',
  ])

  expect(
    labels(buildLDTrackMenuItems(makeSelf({ minorAlleleFrequencyFilter: 0 }))),
  ).toEqual(['LD metric', 'Show...', 'Filter by...'])
})

test('the count adds up the thresholds and the jexl list', () => {
  const items = buildLDTrackMenuItems(
    makeSelf({
      minorAlleleFrequencyFilter: 0.05,
      hweFilterThreshold: 1e-6,
      callRateFilter: 0.9,
      jexlFiltersSetting: ["jexl:get(feature,'end')>100"],
    }),
  )
  expect(labels(items)).toContain('Filter by... (4)')
})

// Each dialog resets one field at a time; this is the only row that clears the
// set the count names.
test('Clear all filters resets every threshold and the jexl list', () => {
  const self = makeSelf()
  const items = buildLDTrackMenuItems(self)
  const clear = subMenuOf(items, 'Filter by... (1)')?.find(
    i => labelOf(i) === 'Clear all filters',
  )
  if (!clear || !('onClick' in clear)) {
    throw new Error('expected a Clear all filters row')
  }
  clear.onClick()
  expect(self.setMafFilter).toHaveBeenCalledWith(0)
  expect(self.setHweFilter).toHaveBeenCalledWith(0)
  expect(self.setCallRateFilter).toHaveBeenCalledWith(0)
  expect(self.setJexlFilters).toHaveBeenCalledWith(undefined)
})

// The clear row is the only way back out of a pinned focal SNP, so it appears
// exactly when there is one to clear.
test('the focal-SNP row appears only while a SNP is pinned, and clears it', () => {
  expect(labels(buildLDTrackMenuItems(makeSelf()))).not.toContain(
    'Clear focal SNP highlight',
  )

  const setFocalSnp = jest.fn()
  const items = buildLDTrackMenuItems(
    makeSelf({ focalSnpIndex: 3, setFocalSnp }),
  )
  const first = items[0]!

  expect(labelOf(first)).toBe('Clear focal SNP highlight')
  if ('onClick' in first) {
    first.onClick()
  }
  expect(setFocalSnp).toHaveBeenCalledWith(undefined)
})

// A pre-computed file has no genotypes behind it: nothing to filter, and no
// sign to preserve (the file states magnitudes).
test('pre-computed LD drops the filter menu and the signed-LD row', () => {
  const items = buildLDTrackMenuItems(makeSelf({ isPrecomputedLD: true }))

  expect(labels(items)).toEqual(['LD metric', 'Show...'])
  expect(labels(subMenuOf(items, 'LD metric')!)).toEqual([
    'R² (squared correlation)',
    "D' (normalized D)",
  ])
})

test('a file with no DP column offers D-prime disabled, and says why', () => {
  const metric = subMenuOf(
    buildLDTrackMenuItems(
      makeSelf({ isPrecomputedLD: true, dprimeAvailable: false }),
    ),
    'LD metric',
  )!
  const dprime = metric.find(i => labelOf(i) === "D' (normalized D)")!

  expect('disabled' in dprime && dprime.disabled).toBe(true)
  expect('helpText' in dprime && dprime.helpText).toBe(
    "This LD file has no D' (DP) column",
  )
})

// The help text has to name the estimator the loaded values actually came from
// — a composite estimate read as exact haplotypic LD is a wrong number, not a
// wrong-looking one.
test('the metric help names how the values were derived', () => {
  const helpFor = (ldMethod: LDMethod) => {
    const r2 = subMenuOf(
      buildLDTrackMenuItems(makeSelf({ ldMethod })),
      'LD metric',
    )![0]!
    return 'helpText' in r2 ? r2.helpText : undefined
  }

  expect(helpFor('phased')).toContain('exact haplotypic LD')
  expect(helpFor('composite')).toContain('composite (Weir)')
  expect(helpFor('precomputed')).toContain('pre-computed LD file')
})

// The note describes the ESTIMATOR, and must not describe the DATA. Since the
// `ldMethod` slot landed, 'composite' is honoured on a phased callset — putting
// a phased panel and an unphased cohort on one scale is what it is for — so
// "estimated from unphased genotypes" was a claim about the file that the file
// contradicts.
test('the composite note does not call the data unphased', () => {
  const r2 = subMenuOf(
    buildLDTrackMenuItems(makeSelf({ ldMethod: 'composite' })),
    'LD metric',
  )![0]!
  const help = 'helpText' in r2 ? r2.helpText! : ''

  expect(help).not.toMatch(/unphased/i)
  expect(help).toContain('ignores phase')
})

// D' is where the composite estimator does more than approximate. It normalizes
// by the allele frequencies alone, so a Hardy-Weinberg departure inflates the
// ratio past 1 and `dprimeFinalize` clamps it — see
// `packages/ld-core/src/compositeDprimeClamp.test.ts`, where the same pair reads
// 0.8385 haplotypic and exactly 1.0000 composite off a raw ratio of 1.6053.
// The row used to call that difference "slight".
test("the D' note says the composite value saturates, not that it differs slightly", () => {
  const dprimeHelp = (ldMethod: LDMethod) => {
    const metric = subMenuOf(
      buildLDTrackMenuItems(makeSelf({ ldMethod })),
      'LD metric',
    )!
    const row = metric.find(i => labelOf(i) === "D' (normalized D)")!
    return 'helpText' in row ? row.helpText! : ''
  }

  expect(dprimeHelp('composite')).not.toMatch(/slight/i)
  expect(dprimeHelp('composite')).toContain('clamped at 1')
  // and the caveat is about the estimator, so it stays off the other two rows
  expect(dprimeHelp('phased')).not.toMatch(/clamped/i)
  expect(dprimeHelp('precomputed')).not.toMatch(/clamped/i)
})

test('the Show menu carries every visibility and layout toggle', () => {
  expect(
    labels(subMenuOf(buildLDTrackMenuItems(makeSelf()), 'Show...')!),
  ).toEqual([
    'Show LD triangle',
    'Show legend',
    'Show variant labels',
    'Show vertical guides on hover',
    'Fit to display height',
    'Show cells with genome proportions',
  ])
})
