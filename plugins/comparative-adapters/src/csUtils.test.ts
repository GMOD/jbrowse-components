import {
  DELETION_TYPE,
  INSERTION_TYPE,
  MISMATCH_TYPE,
} from '@jbrowse/cigar-utils'

import { flipCs, forEachCsMismatch } from './csUtils.ts'

describe('flipCs', () => {
  test('swaps substitution ref/query bases', () => {
    expect(flipCs(':6*ct:4')).toBe(':6*tc:4')
  })

  test('swaps insertions and deletions', () => {
    expect(flipCs(':6+gtc:3-a')).toBe(':6-gtc:3+a')
  })
})

describe('forEachCsMismatch', () => {
  function collect(cs: string, ws?: number, we?: number) {
    const out: { type: number; start: number; base: string; len: number }[] = []
    forEachCsMismatch(
      cs,
      (type, start, length, base, _qual, _altbase, cliplen) => {
        out.push({ type, start, base, len: cliplen ?? length })
      },
      ws,
      we,
    )
    return out
  }

  test('emits substitutions with the real query base at ref offsets', () => {
    // :6 (0-5) *ct at 6 :4 (7-10) *ga at 11
    expect(collect(':6*ct:4*ga')).toEqual([
      { type: MISMATCH_TYPE, start: 6, base: 't', len: 1 },
      { type: MISMATCH_TYPE, start: 11, base: 'a', len: 1 },
    ])
  })

  test('emits insertions (no ref advance) and deletions (ref advance)', () => {
    // :3 (0-2) +gt insertion at 3 :2 (3-4) -aa deletion at 5..6
    const out = collect(':3+gt:2-aa:1')
    expect(out).toEqual([
      { type: INSERTION_TYPE, start: 3, base: 'gt', len: 2 },
      { type: DELETION_TYPE, start: 5, base: '', len: 2 },
    ])
  })

  test('windowStart/windowEnd clip substitutions', () => {
    // subs at ref 2 (c), 5 (t), 8 (a); window [5,8) keeps only ref 5
    expect(collect(':2*ac:2*gt:2*ca', 5, 8)).toEqual([
      { type: MISMATCH_TYPE, start: 5, base: 't', len: 1 },
    ])
  })
})
