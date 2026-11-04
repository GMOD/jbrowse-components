import { namesToBlock } from '@jbrowse/alignments-core'

import { basePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'
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

test('a synteny block names its other side', () => {
  const tip = formatReadTooltip(
    block({ readMateLines: ['Fgfr2 mm39 chr7:129,764,001-129,868,000'] }),
    0,
    'chr10',
  )
  expect(tip.title).toBe('FGFR2')
  expect(tip.lines).toContain('Mate: Fgfr2 mm39 chr7:129,764,001-129,868,000')
})
