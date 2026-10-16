import {
  READ_SPLIT,
  READ_SV_DELETION,
  withSvTier,
} from '@jbrowse/alignments-core'

import { makePileupDataResult } from '../RenderAlignmentDataRPC/testPileupData.ts'
import { presentBakedValues } from './presentBakedValues.ts'

function region(bits: number[]) {
  return makePileupDataResult({
    readCategoryBits: Uint8Array.from(bits),
    readFlags: new Uint16Array(bits.length),
    readPairOrientations: new Uint8Array(bits.length),
    readTagValues: bits.map(() => 'stale'),
  })
}

const placedSplit = withSvTier(READ_SPLIT, 60, 'ctgA,1,+,50M,60,0;', undefined)
const indel = withSvTier(READ_SV_DELETION, 60, '', undefined)

test('a read-level field lists the levels its reads take, across lanes', () => {
  const byGroup = new Map([
    ['a', new Map([[0, region([placedSplit, 0])]])],
    ['b', new Map([[0, region([indel])]])],
  ])
  expect(presentBakedValues({ type: 'svSignal' }, byGroup)).toEqual(
    new Set(['', 'splitRead', 'svIndel']),
  )
  expect(presentBakedValues({ type: 'split' }, byGroup)).toEqual(
    new Set(['', 'split']),
  )
})

test('a tag lists the values the worker shipped', () => {
  const byGroup = new Map([['', new Map([[0, region([0])]])]])
  expect(presentBakedValues({ type: 'tag', tag: 'HP' }, byGroup)).toEqual(
    new Set(['stale']),
  )
})
