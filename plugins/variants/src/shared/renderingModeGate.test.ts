import { createTestEnvironment } from '../LinearMultiSampleVariantDisplay/testEnv.ts'

import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// The rendering-mode submenu is the only door a user has into phased mode —
// `setPhasedMode` has no other caller — so this row decides whether a callset
// the painter renders correctly is reachable at all. The gate is the painter's
// own predicate (`isPhasedOrHaploid`, i.e. no `/`) rather than a literal `|`,
// because a pangenome callset is haploid per assembly path: `vg deconstruct`
// writes bare `0`/`1`/`23` and no `|` appears in the file anywhere.
//
// No cells here — only the summary flags the worker ships alongside them, which
// are what the menu reads.
function cellData(flags: {
  hasPhased: boolean
  hasPhasedOrHaploid: boolean
}): CellDataResult {
  return {
    mode: 'regular',
    sampleInfo: { S0: { maxPloidy: 2, isPhased: flags.hasPhased } },
    rowNames: ['S0'],
    hasSecondaryAlt: false,
    hasUnphased: false,
    hasNoCall: false,
    hasConsequence: false,
    hasSvType: false,
    hasPhaseSet: false,
    svTypeColors: {},
    simplifiedFeatures: [],
    genotypeDict: [],
    sampleNames: ['S0'],
    perRegionCellData: {},
    ...flags,
  }
}

function phasedRow(flags?: {
  hasPhased: boolean
  hasPhasedOrHaploid: boolean
}) {
  const { display } = createTestEnvironment().createDisplay()
  if (flags) {
    display.setCellData(cellData(flags))
  }
  const mode = display
    .trackMenuItems()
    .find(item => 'label' in item && item.label === 'Rendering mode')
  const subMenu: MenuItem[] = mode && 'subMenu' in mode ? mode.subMenu : []
  const row = subMenu.find(
    item =>
      'label' in item &&
      typeof item.label === 'string' &&
      item.label.startsWith('Phased'),
  )
  if (!row) {
    throw new Error('no "Phased" rendering-mode row')
  }
  return row as MenuItem & {
    label: string
    disabled?: boolean
    disabledHelpText?: string
  }
}

const diploidPhased = { hasPhased: true, hasPhasedOrHaploid: true }
const diploidUnphased = { hasPhased: false, hasPhasedOrHaploid: false }
// what a `vg deconstruct` pangenome VCF looks like: haploid everywhere, so no
// `|` in the file and `hasPhased` false across the whole callset
const haploid = { hasPhased: false, hasPhasedOrHaploid: true }

test('offers phased mode on a phased diploid callset', () => {
  const row = phasedRow(diploidPhased)

  expect(row.disabled).toBe(false)
  expect(row.label).toBe('Phased')
})

test('offers phased mode on a callset that is entirely haploid', () => {
  const row = phasedRow(haploid)

  expect(row.disabled).toBe(false)
  expect(row.label).toBe('Phased')
})

test('refuses phased mode when every genotype is unphased, and says so', () => {
  const row = phasedRow(diploidUnphased)

  expect(row.disabled).toBe(true)
  expect(row.label).toBe('Phased (disabled, every genotype is unphased)')
  expect(row.disabledHelpText).toBe(
    'Every genotype in view is unphased (a / separator), so there is no haplotype to split a sample into',
  )
})

// Before a fetch lands the answer is unknown, not "no" — a row that blamed the
// callset would be wrong about why it is off.
test('says it is still checking before the first fetch lands', () => {
  const row = phasedRow()

  expect(row.disabled).toBe(true)
  expect(row.label).toBe('Phased (checking for phased variants...)')
  expect(row.disabledHelpText).toBe('Checking for phased variants...')
})
