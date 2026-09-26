import { SimpleFeature } from '@jbrowse/core/util'

import { getModTag } from './getModTag.ts'

import type { Feature } from '@jbrowse/core/util'

function read(tags: Record<string, unknown>, seq = 'CGCG') {
  return new SimpleFeature({
    uniqueId: 'r1',
    refName: 'ctgA',
    start: 0,
    end: seq.length,
    seq,
    tags,
  })
}

function bamLikeRead(tags: Record<string, unknown>, seqLength: number) {
  return {
    getTag: (t: string) => tags[t],
    get: (field: string) => (field === 'seq_length' ? seqLength : undefined),
  } as unknown as Feature
}

test('MM without MN is taken as is', () => {
  expect(getModTag(read({ MM: 'C+m,0;' }))).toBe('C+m,0;')
})

test('MN matching the sequence length keeps MM', () => {
  expect(getModTag(read({ MM: 'C+m,0;', MN: 4 }))).toBe('C+m,0;')
})

test('MN disagreeing with the sequence length drops MM', () => {
  expect(getModTag(read({ MM: 'C+m,0;', MN: 10 }))).toBeUndefined()
})

test('a read with no SEQ fails the MN check', () => {
  expect(getModTag(read({ MM: 'C+m,0;', MN: 4 }, ''))).toBeUndefined()
})

test('MN as SAM text compares numerically', () => {
  expect(getModTag(read({ Mm: 'C+m,0;', MN: '4' }))).toBe('C+m,0;')
})

test('seq_length answers the check without decoding SEQ', () => {
  expect(getModTag(bamLikeRead({ MM: 'C+m,0;', MN: 4 }, 4))).toBe('C+m,0;')
  expect(getModTag(bamLikeRead({ MM: 'C+m,0;', MN: 5 }, 4))).toBeUndefined()
})
