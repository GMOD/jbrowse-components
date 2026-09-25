import {
  colorInterchrom,
  colorLongInsert,
  colorSplitReadInversion,
} from '@jbrowse/core/ui/palette'

import {
  connectionColor,
  connectionKeyRows,
  connectionKind,
  connectionLabel,
  isAbnormalConnection,
} from './connectionStyle.ts'

const pair = { isSplit: false, interchrom: false, s1: 1, s2: -1 }
const split = { isSplit: true, interchrom: false, pairDirection: undefined }
const alignmentFill = { pairRL: 'rl', pairRR: 'rr', pairLL: 'll' }

test('a mate link takes its pair orientation', () => {
  expect(connectionKind({ ...pair, pairDirection: 'RR' })).toBe('pairRR')
  expect(connectionKind({ ...pair, pairDirection: undefined })).toBe('readPair')
})

test('a split junction takes its strands', () => {
  expect(connectionKind({ ...split, s1: 1, s2: -1 })).toBe('splitInversion')
  expect(connectionKind({ ...split, s1: -1, s2: 1 })).toBe('splitInversion')
  expect(connectionKind({ ...split, s1: 1, s2: 1 })).toBe('splitDeletion')
  expect(connectionKind({ ...split, s1: 0, s2: 1 })).toBe('readPair')
})

test('any connection across chromosomes is interchromosomal', () => {
  expect(
    connectionKind({ ...pair, interchrom: true, pairDirection: 'LL' }),
  ).toBe('interchrom')
  expect(connectionKind({ ...split, interchrom: true, s1: 1, s2: -1 })).toBe(
    'interchrom',
  )
})

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

test('only an aberrant orientation or a strand flip dips', () => {
  expect(isAbnormalConnection('pairLR')).toBe(false)
  expect(isAbnormalConnection('splitDeletion')).toBe(false)
  expect(isAbnormalConnection('interchrom')).toBe(false)
  expect(isAbnormalConnection('pairLL')).toBe(true)
  expect(isAbnormalConnection('splitInversion')).toBe(true)
})

test('labels say what reaches this view', () => {
  expect(connectionLabel('pairLR', false)).toBe('LR - Not a proper pair')
  expect(connectionLabel('interchrom', false)).toBe('Inter-chromosomal')
  expect(connectionLabel('interchrom', true)).toBe(
    'Split alignment (interchromosomal)',
  )
})

test('the key has one row per colour', () => {
  const rows = connectionKeyRows([
    { kind: 'pairLR', isSplit: false },
    { kind: 'splitDeletion', isSplit: true },
    { kind: 'interchrom', isSplit: false },
    { kind: 'interchrom', isSplit: true },
    { kind: 'pairRR', isSplit: false },
  ])
  expect(rows.map(r => r.labels)).toEqual([
    ['LR - Not a proper pair', 'Split alignment (same strand)'],
    ['Inter-chromosomal', 'Split alignment (interchromosomal)'],
    ['RR - Both mates reverse strand'],
  ])
})
