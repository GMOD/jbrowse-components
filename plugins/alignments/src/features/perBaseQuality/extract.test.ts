import { extractPerBaseQuality } from './extract.ts'

import type { PerBaseQualityEntry } from './types.ts'
import type { Feature } from '@jbrowse/core/util'

function makeFeature(opts: {
  start: number
  cigar: string
  qual: Uint8Array
}): Feature {
  return {
    id: () => 'f',
    get(field: string) {
      switch (field) {
        case 'start':
          return opts.start
        case 'CIGAR':
          return opts.cigar
        case 'NUMERIC_QUAL':
          return opts.qual
        default:
          return undefined
      }
    },
  } as unknown as Feature
}

function run(opts: { start: number; cigar: string; qual: Uint8Array; regionStart?: number; regionEnd?: number }) {
  const out: PerBaseQualityEntry[] = []
  extractPerBaseQuality(
    makeFeature(opts),
    'f',
    opts.regionStart ?? 0,
    opts.regionEnd ?? 1000,
    out,
  )
  return out.map(e => [e.position, e.score])
}

describe('extractPerBaseQuality', () => {
  test('plain match emits one entry per aligned base', () => {
    expect(
      run({ start: 100, cigar: '5M', qual: new Uint8Array([10, 20, 30, 40, 50]) }),
    ).toEqual([
      [100, 10],
      [101, 20],
      [102, 30],
      [103, 40],
      [104, 50],
    ])
  })

  test('clips to region bounds', () => {
    expect(
      run({
        start: 100,
        cigar: '10M',
        qual: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
        regionStart: 103,
        regionEnd: 107,
      }),
    ).toEqual([
      [103, 4],
      [104, 5],
      [105, 6],
      [106, 7],
    ])
  })

  test('soft clip advances soffset only', () => {
    expect(
      run({ start: 100, cigar: '2S3M', qual: new Uint8Array([99, 99, 30, 40, 50]) }),
    ).toEqual([
      [100, 30],
      [101, 40],
      [102, 50],
    ])
  })

  test('insertion advances soffset only', () => {
    expect(
      run({
        start: 100,
        cigar: '2M2I2M',
        qual: new Uint8Array([10, 20, 99, 99, 30, 40]),
      }),
    ).toEqual([
      [100, 10],
      [101, 20],
      [102, 30],
      [103, 40],
    ])
  })

  test('deletion advances roffset only', () => {
    expect(
      run({ start: 100, cigar: '2M2D2M', qual: new Uint8Array([10, 20, 30, 40]) }),
    ).toEqual([
      [100, 10],
      [101, 20],
      [104, 30],
      [105, 40],
    ])
  })

  test('skip (N) advances roffset only', () => {
    expect(
      run({ start: 100, cigar: '2M100N2M', qual: new Uint8Array([10, 20, 30, 40]) }),
    ).toEqual([
      [100, 10],
      [101, 20],
      [202, 30],
      [203, 40],
    ])
  })

  test('missing NUMERIC_QUAL: emits nothing', () => {
    const out: PerBaseQualityEntry[] = []
    const feature = { id: () => 'f', get: () => undefined } as unknown as Feature
    extractPerBaseQuality(feature, 'f', 0, 1000, out)
    expect(out).toEqual([])
  })
})
