import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

import { createTestEnvironment } from '../LinearMultiSampleVariantDisplay/testEnv.ts'

import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// The Rows submenu is the only door a user has into per-haplotype rows —
// `setUnit` has no other caller — so this row decides whether a callset
// the painter renders correctly is reachable at all. The gate is the painter's
// own predicate (`isPhasedOrHaploid`, i.e. no `/`) rather than a literal `|`,
// because a pangenome callset is haploid per assembly path: `vg deconstruct`
// writes bare `0`/`1`/`23` and no `|` appears in the file anywhere.
//
// No cells here — only the summary flags the worker ships alongside them, which
// are what the menu reads.
function cellData({
  ploidy,
  ...flags
}: {
  ploidy: number
  hasPhasedOrHaploid: boolean
}): CellDataResult {
  return {
    samplePloidy: { S0: ploidy },
    rowNames: ['S0'],
    hasSecondaryAlt: false,
    hasUnphased: false,
    hasNoCall: false,
    colorRead: undefined,
    hasConsequence: false,
    hasSvType: false,
    hasPhaseSet: false,
    simplifiedFeatures: [],
    genotypeDict: [],
    sampleNames: ['S0'],
    perRegionCellData: {},
    ...flags,
  }
}

function phasedRow(flags?: { ploidy: number; hasPhasedOrHaploid: boolean }) {
  const { display } = createTestEnvironment().createDisplay()
  if (flags) {
    display.setCellData(cellData(flags))
  }
  const mode = display
    .trackMenuItems()
    .find(item => 'label' in item && item.label === 'Rows')
  const subMenu: MenuItem[] =
    mode && 'subMenu' in mode ? resolveSubMenu(mode) : []
  const row = subMenu.find(
    item =>
      'label' in item &&
      typeof item.label === 'string' &&
      item.label.startsWith('Per haplotype'),
  )
  if (!row) {
    throw new Error('no "Per haplotype" row')
  }
  return row as MenuItem & { label: string; disabled?: boolean }
}

const diploidPhased = { ploidy: 2, hasPhasedOrHaploid: true }
const diploidUnphased = { ploidy: 2, hasPhasedOrHaploid: false }
// what a `vg deconstruct` pangenome VCF looks like: haploid everywhere, so no
// `|` in the file
const haploid = { ploidy: 1, hasPhasedOrHaploid: true }

test('offers per-haplotype rows on a phased diploid callset', () => {
  const row = phasedRow(diploidPhased)

  expect(row.disabled).toBe(false)
  expect(row.label).toBe('Per haplotype')
})

test('offers per-haplotype rows on a callset that is entirely haploid', () => {
  const row = phasedRow(haploid)

  expect(row.disabled).toBe(false)
  expect(row.label).toBe('Per haplotype')
})

test('refuses per-haplotype rows when every genotype in view is unphased, and says so', () => {
  const row = phasedRow(diploidUnphased)

  expect(row.disabled).toBe(true)
  expect(row.label).toBe('Per haplotype (no phased genotypes in view)')
})

// Before a fetch lands the answer is unknown, not "no" — a row that blamed the
// callset would be wrong about why it is off.
test('says it is still checking before the first fetch lands', () => {
  const row = phasedRow()

  expect(row.disabled).toBe(true)
  expect(row.label).toBe('Per haplotype (checking for phased genotypes...)')
})
