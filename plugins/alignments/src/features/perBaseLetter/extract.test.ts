import { parseCigar2 } from '@jbrowse/cigar-utils'

import { extractPerBaseLetter } from './extract.ts'

import type { PerBaseLetterEntry } from './types.ts'
import type { Feature } from '@jbrowse/core/util'

// `numericCigar: false` models an adapter that carries only the text CIGAR —
// NUMERIC_CIGAR is an optimization BAM/CRAM can supply for free, not something a
// feature has to have (see packedCigarOps).
function makeFeature(opts: {
  start: number
  cigar: string
  seq: string
  numericCigar?: boolean
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
          return opts.numericCigar === false ? undefined : numericCigar
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
  numericCigar?: boolean
  binBp?: number
}) {
  const out: PerBaseLetterEntry[] = []
  extractPerBaseLetter(
    makeFeature(opts),
    0,
    {
      refName: 'ctgA',
      assemblyName: 'volvox',
      start: opts.regionStart ?? 0,
      end: opts.regionEnd ?? 1000,
    },
    opts.binBp ?? 1,
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

  // A text-only adapter (SAM, or any plugin-supplied feature) must paint the
  // same bases as one handing over the packed array — otherwise NUMERIC_CIGAR is
  // a hidden requirement whose absence silently draws nothing.
  test('a text-only CIGAR gives the same result as the packed one', () => {
    const args = { start: 100, cigar: '2S3M2I2M2D2M', seq: 'NNACGTTGTAC' }
    expect(run({ ...args, numericCigar: false })).toEqual(run(args))
    expect(run({ ...args, numericCigar: false })).toEqual([
      [100, 'A'],
      [101, 'C'],
      [102, 'G'],
      [103, 'G'],
      [104, 'T'],
      [107, 'A'],
      [108, 'C'],
    ])
  })

  test('no CIGAR at all: emits nothing', () => {
    expect(
      run({ start: 100, cigar: '', seq: 'ACGT', numericCigar: false }),
    ).toEqual([])
  })

  test('missing seq: emits nothing', () => {
    const out: PerBaseLetterEntry[] = []
    const feature = {
      id: () => 'f',
      get: () => undefined,
    } as unknown as Feature
    extractPerBaseLetter(
      feature,
      0,
      { refName: 'ctgA', assemblyName: 'volvox', start: 0, end: 1000 },
      1,
      out,
    )
    expect(out).toEqual([])
  })

  test('binning samples the first base of each window', () => {
    expect(run({ start: 100, cigar: '8M', seq: 'ACGTACGT', binBp: 4 })).toEqual(
      [
        [100, 'A'],
        [104, 'A'],
      ],
    )
  })

  test('an insertion does not shift the following bin', () => {
    // The bins stay on absolute coordinates 100/104, and the read offsets
    // behind them still skip the inserted bases.
    expect(
      run({ start: 100, cigar: '4M2I4M', seq: 'ACGTTTACGT', binBp: 4 }),
    ).toEqual([
      [100, 'A'],
      [104, 'A'],
    ])
  })
})
