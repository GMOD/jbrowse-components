import {
  colorInterchrom,
  colorLongInsert,
  colorSplitReadInversion,
} from '@jbrowse/core/ui/palette'

import {
  connectionColor,
  connectionKeyRows,
  connectionLabel,
} from './connectionStyle.ts'

const alignmentFill = { pairRL: 'rl', pairRR: 'rr', pairLL: 'll' }

test('evidence the pileup fades draws in long-insert red', () => {
  expect(connectionColor('pairLR', alignmentFill)).toBe(colorLongInsert)
  expect(connectionColor('readPair', alignmentFill)).toBe(colorLongInsert)
  expect(connectionColor('splitDeletion', alignmentFill)).toBe(colorLongInsert)
  expect(connectionColor('pairRR', alignmentFill)).toBe('rr')
  expect(connectionColor('splitInversion', alignmentFill)).toBe(
    colorSplitReadInversion,
  )
  expect(connectionColor('interchrom', alignmentFill)).toBe(colorInterchrom)
})

test('labels say what reaches this view', () => {
  expect(connectionLabel('pairLR')).toBe('LR - Not a proper pair')
  expect(connectionLabel('interchrom')).toBe('Inter-chromosomal')
  expect(connectionLabel('splitDeletion')).toBe('Split alignment (same strand)')
})

test('the key has one row per colour', () => {
  const rows = connectionKeyRows([
    'pairLR',
    'splitDeletion',
    'interchrom',
    'pairRR',
  ])
  expect(rows.map(r => r.labels)).toEqual([
    ['LR - Not a proper pair', 'Split alignment (same strand)'],
    ['Inter-chromosomal'],
    ['RR - Both mates reverse strand'],
  ])
})
