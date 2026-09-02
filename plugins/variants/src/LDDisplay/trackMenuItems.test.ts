import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

import { buildLDTrackMenuItems } from './trackMenuItems.ts'

import type { LDMenuSelf } from './trackMenuItems.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// The shape of the LD track menu, as opposed to what its items do. The builder
// takes a structural interface, so this needs no display instance.
function makeSelf(overrides: Partial<LDMenuSelf> = {}) {
  const stub = {
    effectiveLdMetric: 'r2' as const,
    dprimeAvailable: true,
    focalSnpIndex: -1,
    showLDTriangle: true,
    showLegend: false,
    showLegendDisplayTypeDefault: {
      kind: 'toggle' as const,
      slot: 'showLegend',
      onValue: false,
      active: false,
      toggle: () => {},
    },
    showLabels: false,
    showVerticalGuides: true,
    squashToHeight: false,
    useGenomicPositions: false,
    setFocalSnp: jest.fn(),
    setLDMetric: jest.fn(),
    setShowLDTriangle: jest.fn(),
    setShowLegend: jest.fn(),
    setShowLabels: jest.fn(),
    setShowVerticalGuides: jest.fn(),
    setSquashToHeight: jest.fn(),
    setUseGenomicPositions: jest.fn(),
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
  return item && 'subMenu' in item ? resolveSubMenu(item) : undefined
}

// No filter rows: the values come out of a file already thinned by whatever
// wrote it, and there are no genotypes here to filter. The rows that were here
// (MAF / HWE / call rate / jexl) went with the genotype path.
test('the menu is metric + show', () => {
  const items = buildLDTrackMenuItems(makeSelf())

  expect(labels(items)).toEqual(['LD metric', 'Show...'])
  expect(labels(subMenuOf(items, 'LD metric')!)).toEqual([
    'R² (squared correlation)',
    "D' (normalized D)",
  ])
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

test('a file with no DP column offers D-prime disabled, and says why', () => {
  const metric = subMenuOf(
    buildLDTrackMenuItems(makeSelf({ dprimeAvailable: false })),
    'LD metric',
  )!
  const dprime = metric.find(i => labelOf(i) === "D' (normalized D)")!

  expect('disabled' in dprime && dprime.disabled).toBe(true)
  expect('helpText' in dprime && dprime.helpText).toBe(
    "This LD file has no D' (DP) column",
  )
})

// The help says the number was read, not computed. JBrowse does not estimate LD
// from genotypes, and a row implying it did is a claim about provenance.
test('the metric help says the values are read from the file', () => {
  const metric = subMenuOf(buildLDTrackMenuItems(makeSelf()), 'LD metric')!
  const help = metric.map(i => ('helpText' in i ? i.helpText! : ''))

  expect(help[0]).toContain('read from the LD file')
  expect(help[1]).toContain('read from the LD file')
  expect(help.join(' ')).not.toMatch(/composite|estimated|Weir/i)
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
