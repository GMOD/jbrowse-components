import { parseCigar2 } from '@jbrowse/alignments-core'

import { extractPerBaseLetter } from './extract.ts'

import type { PerBaseLetterEntry } from './types.ts'
import type { Feature } from '@jbrowse/core/util'

function makeFeature(opts: {
  start: number
  cigar: string
  seq: string
}): Feature {
  const numericCigar = new Uint32Array(parseCigar2(opts.cigar))
  return {
    id: () => 'f',
    get(field: string) {
      switch (field) {
        case 'start':
          return opts.start
        case 'CIGAR':
          return opts.cigar
        case 'NUMERIC_CIGAR':
          return numericCigar
        case 'seq':
          return opts.seq
        default:
          return undefined
      }
    },
  } as unknown as Feature
}

function run(opts: {
  start: number
  cigar: string
  seq: string
  regionStart?: number
  regionEnd?: number
}) {
  const out: PerBaseLetterEntry[] = []
  extractPerBaseLetter(
    makeFeature(opts),
    'f',
    {
      refName: 'ctgA',
      assemblyName: 'volvox',
      start: opts.regionStart ?? 0,
      end: opts.regionEnd ?? 1000,
    },
    out,
  )
  // decode base code back to a letter for readable assertions
  return out.map(e => [e.position, String.fromCharCode(e.base)])
}

describe('extractPerBaseLetter', () => {
  test('plain match emits one entry per aligned base', () => {
    expect(run({ start: 100, cigar: '5M', seq: 'ACGTN' })).toEqual([
      [100, 'A'],
      [101, 'C'],
      [102, 'G'],
      [103, 'T'],
      [104, 'N'],
    ])
  })

  test('lowercase (soft-masked) bases uppercase to the same palette key', () => {
    expect(run({ start: 100, cigar: '3M', seq: 'acg' })).toEqual([
      [100, 'A'],
      [101, 'C'],
      [102, 'G'],
    ])
  })

  test('clips to region bounds', () => {
    expect(
      run({
        start: 100,
        cigar: '10M',
        seq: 'AAACCCGGGT',
        regionStart: 103,
        regionEnd: 107,
      }),
    ).toEqual([
      [103, 'C'],
      [104, 'C'],
      [105, 'C'],
      [106, 'G'],
    ])
  })

  test('soft clip advances soffset only', () => {
    expect(run({ start: 100, cigar: '2S3M', seq: 'NNACG' })).toEqual([
      [100, 'A'],
      [101, 'C'],
      [102, 'G'],
    ])
  })

  test('insertion advances soffset only', () => {
    expect(run({ start: 100, cigar: '2M2I2M', seq: 'ACTTGT' })).toEqual([
      [100, 'A'],
      [101, 'C'],
      [102, 'G'],
      [103, 'T'],
    ])
  })

  test('deletion advances roffset only', () => {
    expect(run({ start: 100, cigar: '2M2D2M', seq: 'ACGT' })).toEqual([
      [100, 'A'],
      [101, 'C'],
      [104, 'G'],
      [105, 'T'],
    ])
  })

  test('skip (N) advances roffset only', () => {
    expect(run({ start: 100, cigar: '2M100N2M', seq: 'ACGT' })).toEqual([
      [100, 'A'],
      [101, 'C'],
      [202, 'G'],
      [203, 'T'],
    ])
  })

  test('missing seq: emits nothing', () => {
    const out: PerBaseLetterEntry[] = []
    const feature = {
      id: () => 'f',
      get: () => undefined,
    } as unknown as Feature
    extractPerBaseLetter(
      feature,
      'f',
      { refName: 'ctgA', assemblyName: 'volvox', start: 0, end: 1000 },
      out,
    )
    expect(out).toEqual([])
  })
})
