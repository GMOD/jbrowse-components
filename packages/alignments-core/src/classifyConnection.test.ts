import { SAM_FLAG_SUPPLEMENTARY } from '@jbrowse/cigar-utils'

import { PAIR_DIRECTION_NUM } from './orientation.ts'
import {
  classifyConnection,
  isAbnormalConnection,
} from './readGroupConnections.ts'

import type { ConnectionReadArrays } from './readGroupConnections.ts'

function entry({
  strand = 1,
  flags = 0,
  orientation = 0,
  interchrom = 0,
}: {
  strand?: number
  flags?: number
  orientation?: number
  interchrom?: number
} = {}) {
  const data: ConnectionReadArrays = {
    readKeys: ['r'],
    readPositions: Uint32Array.from([100, 200]),
    readFlags: Uint16Array.from([flags]),
    readStrands: Int8Array.from([strand]),
    readInterchrom: Uint8Array.from([interchrom]),
    readPairOrientations: Uint8Array.from([orientation]),
  }
  return { data, readIdx: 0 }
}

const kindOf = (
  e1: ReturnType<typeof entry>,
  e2: ReturnType<typeof entry>,
  isSplit: boolean,
) => classifyConnection({ e1, e2, isSplit }).kind

test('a split junction takes its strands, on any pair of chromosomes', () => {
  expect(kindOf(entry(), entry(), true)).toBe('splitDeletion')
  expect(kindOf(entry({ strand: -1 }), entry({ strand: -1 }), true)).toBe(
    'splitDeletion',
  )
  expect(kindOf(entry(), entry({ strand: -1 }), true)).toBe('splitInversion')
  expect(kindOf(entry({ interchrom: 1 }), entry({ interchrom: 1 }), true)).toBe(
    'splitDeletion',
  )
  expect(kindOf(entry({ strand: 0 }), entry(), true)).toBe('readPair')
})

test('a mate link takes its pair direction, or inter-chromosomal ahead of it', () => {
  const rl = { orientation: PAIR_DIRECTION_NUM.RL }
  expect(kindOf(entry(rl), entry(rl), false)).toBe('pairRL')
  expect(kindOf(entry(), entry(), false)).toBe('readPair')
  const lr = { orientation: PAIR_DIRECTION_NUM.LR, interchrom: 1 }
  expect(kindOf(entry(lr), entry(lr), false)).toBe('interchrom')
})

test('a mate link reads its pair fields off a primary', () => {
  const supp = entry({
    flags: SAM_FLAG_SUPPLEMENTARY,
    orientation: PAIR_DIRECTION_NUM.LR,
  })
  const primary = entry({ orientation: PAIR_DIRECTION_NUM.RL })
  expect(kindOf(supp, primary, false)).toBe('pairRL')
})

test('only an aberrant pair, a strand flip or a translocation dips', () => {
  expect(isAbnormalConnection('readPair')).toBe(false)
  expect(isAbnormalConnection('pairLR')).toBe(false)
  expect(isAbnormalConnection('splitDeletion')).toBe(false)
  expect(isAbnormalConnection('pairRL')).toBe(true)
  expect(isAbnormalConnection('pairLL')).toBe(true)
  expect(isAbnormalConnection('splitInversion')).toBe(true)
  expect(isAbnormalConnection('interchrom')).toBe(true)
})
