import { namesToBlock } from '@jbrowse/alignments-core'

import { basePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import { READ_COLOR_CATEGORY } from '../colorUtils.ts'
import { formatReadTooltip } from './tooltipUtils.ts'

function block(overrides: Partial<ReturnType<typeof basePileupDataResult>>) {
  return {
    ...basePileupDataResult(1),
    ...namesToBlock(['FGFR2']),
    readPositions: new Uint32Array([1000, 2000]),
    ...overrides,
  }
}

test('unset, the title is the read name and no Name line is added', () => {
  const tip = formatReadTooltip(block({}), 0, 'chr10')
  expect(tip.title).toBe('FGFR2')
  expect(tip.lines.some(l => l.startsWith('Name:'))).toBe(false)
})

test('a tooltip value titles the hover and the read name moves to a line', () => {
  const tip = formatReadTooltip(
    block({ readTooltipValues: ['Fgfr2'] }),
    0,
    'chr10',
  )
  expect(tip.title).toBe('Fgfr2')
  expect(tip.lines[0]).toBe('Name: FGFR2')
})

test('an empty tooltip value falls back to the read name', () => {
  const tip = formatReadTooltip(block({ readTooltipValues: [''] }), 0, 'chr10')
  expect(tip.title).toBe('FGFR2')
  expect(tip.lines.some(l => l.startsWith('Name:'))).toBe(false)
})

test('a nameless block keeps no empty Name line', () => {
  const tip = formatReadTooltip(
    block({ ...namesToBlock(['']), readTooltipValues: ['chr7'] }),
    0,
    'chr10',
  )
  expect(tip.title).toBe('chr7')
  expect(tip.lines.some(l => l.startsWith('Name:'))).toBe(false)
})

const DESCRIPTION = [
  'hg38 chr10:121,478,001-121,598,000 (120,000 bp)',
  'mm39 Fgfr2 chr7:129,764,001-129,868,000 (104,000 bp)',
  'Inverted',
]

// the read lines (location with strand, MAPQ, the color) would restate the
// description, or for an anchor score misread as MAPQ, contradict it
test("a synteny block's hover is its description", () => {
  const tip = formatReadTooltip(
    block({
      readBlockLines: [DESCRIPTION.join('\n')],
      readColorCategories: Uint8Array.from([READ_COLOR_CATEGORY.plain]),
    }),
    0,
    'chr10',
    () => 'Reverse strand',
  )
  expect(tip.title).toBe('FGFR2')
  expect(tip.lines).toEqual(DESCRIPTION)
})

test('a read names its color', () => {
  const tip = formatReadTooltip(
    block({
      readColorCategories: Uint8Array.from([READ_COLOR_CATEGORY.plain]),
    }),
    0,
    'chr10',
    () => 'Reverse strand',
  )
  expect(tip.lines).toContain('Color: Reverse strand')
})
