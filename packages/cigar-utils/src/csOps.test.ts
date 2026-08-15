import { flipCs, forEachCsMismatch, forEachCsOp } from './csOps.ts'
import {
  DELETION_TYPE,
  INSERTION_TYPE,
  MISMATCH_TYPE,
  SKIP_TYPE,
} from './mismatchCallback.ts'

function ops(cs: string) {
  const out: [string, number, number, string][] = []
  forEachCsOp(cs, (op, refLen, queryLen, s, e) => {
    out.push([op, refLen, queryLen, cs.slice(s, e)])
  })
  return out
}

describe('forEachCsOp', () => {
  test('short form', () => {
    expect(ops(':6*ct+gg-aa')).toEqual([
      [':', 6, 6, '6'],
      ['*', 1, 1, 'ct'],
      ['+', 0, 2, 'gg'],
      ['-', 2, 0, 'aa'],
    ])
  })

  test('long form match runs', () => {
    expect(ops('=ACGT*ct')).toEqual([
      ['=', 4, 4, 'ACGT'],
      ['*', 1, 1, 'ct'],
    ])
  })

  test('an intron consumes reference only, motifs and all', () => {
    expect(ops(':3~gt120ag:4')).toEqual([
      [':', 3, 3, '3'],
      ['~', 120, 0, 'gt120ag'],
      [':', 4, 4, '4'],
    ])
  })

  test('a truncated tail terminates rather than looping', () => {
    expect(ops(':12*a')).toEqual([
      [':', 12, 12, '12'],
      ['*', 1, 1, 'a'],
    ])
  })
})

describe('flipCs', () => {
  test('swaps substitution ref/query bases', () => {
    expect(flipCs(':6*ct:4')).toBe(':6*tc:4')
  })

  test('swaps insertions and deletions', () => {
    expect(flipCs(':6+gtc:3-a')).toBe(':6-gtc:3+a')
  })

  test('carries long-form match runs through', () => {
    expect(flipCs('=ACGT*ct')).toBe('=ACGT*tc')
  })

  // this used to drop the `~` and then mis-scan its motif and length as
  // unknown characters, so the flipped string silently lost the intron's
  // reference span and every later op moved left by it
  test('declines a string it cannot state in the other perspective', () => {
    expect(flipCs(':3~gt120ag:4')).toBeUndefined()
  })
})

describe('forEachCsMismatch', () => {
  function collect(cs: string, ws?: number, we?: number) {
    const out: { type: number; start: number; base: string; len: number }[] = []
    forEachCsMismatch(
      cs,
      (type, start, length, base, _qual, _altbase, cliplen) => {
        // read bases consumed where there are any (insertions), reference
        // bases otherwise. `cliplen` is 0 rather than undefined for the
        // latter, matching @gmod/bam's callback.
        out.push({ type, start, base, len: cliplen || length })
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
    expect(collect(':3+gt:2-aa:1')).toEqual([
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

  test('an intron is a skip, and the reference advances across it', () => {
    expect(collect(':2~gt50ag:1*ac')).toEqual([
      { type: SKIP_TYPE, start: 2, base: '', len: 50 },
      { type: MISMATCH_TYPE, start: 53, base: 'c', len: 1 },
    ])
  })

  // long-form cs advances the reference by the run's length; a walker that
  // ignored `=SEQ` placed everything after the first run at the wrong offset
  test('long-form match runs advance the reference', () => {
    expect(collect('=ACGTA*ac')).toEqual([
      { type: MISMATCH_TYPE, start: 5, base: 'c', len: 1 },
    ])
  })
})
