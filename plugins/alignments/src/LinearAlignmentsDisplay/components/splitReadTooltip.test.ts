import { namesToBlock } from '@jbrowse/alignments-core'

import { makePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import { formatReadTooltip, otherAlignmentLines } from './tooltipUtils.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

function makeRpcData(overrides: Partial<PileupDataResult>) {
  return makePileupDataResult({
    ...namesToBlock(['readA']),
    readPositions: new Uint32Array([1000, 1100]),
    readMapqs: new Uint8Array([60]),
    ...overrides,
  })
}

describe('otherAlignmentLines', () => {
  test('a forward and a reverse piece, in read order', () => {
    expect(
      otherAlignmentLines('chr2,2001,-,60M40S,20,1;chr1,5001,+,30S70M,60,0;'),
    ).toEqual([
      'Also aligned: chr1:5,001-5,070 (+) MAPQ 60',
      'Also aligned: chr2:2,001-2,060 (-) MAPQ 20',
    ])
  })

  test('a piece on another refName names that refName', () => {
    expect(otherAlignmentLines('chrX,101,+,50S50M,7,0')).toEqual([
      'Also aligned: chrX:101-150 (+) MAPQ 7',
    ])
  })

  test('a piece with no MAPQ says none', () => {
    expect(otherAlignmentLines('chr1,101,+,50S50M,,0')).toEqual([
      'Also aligned: chr1:101-150 (+)',
    ])
  })

  test('more than two pieces show the first two in read order and count the rest', () => {
    expect(
      otherAlignmentLines(
        'chr4,401,+,80S20M,60,0;chr1,101,+,10S20M70S,60,0;chr3,301,+,60S20M20S,60,0;chr2,201,+,30S20M50S,60,0;',
      ),
    ).toEqual([
      'Also aligned: chr1:101-120 (+) MAPQ 60',
      'Also aligned: chr2:201-220 (+) MAPQ 60',
      'and 2 more',
    ])
  })

  test('no SA tag, no line', () => {
    expect(otherAlignmentLines(undefined)).toEqual([])
    expect(otherAlignmentLines('')).toEqual([])
  })
})

describe('formatReadTooltip on a split read', () => {
  test('a primary record lists its other alignments', () => {
    const { lines } = formatReadTooltip(
      makeRpcData({ readSuppAlignments: ['chr7,5001,-,40M60S,60,0;'] }),
      0,
      'chr1',
    )
    expect(lines).toContain('Also aligned: chr7:5,001-5,040 (-) MAPQ 60')
  })

  test('a synteny block keeps its description', () => {
    const { lines } = formatReadTooltip(
      makeRpcData({
        readSuppAlignments: ['chr7,5001,-,40M60S,60,0;'],
        readBlockLines: ['block line'],
      }),
      0,
      'chr1',
    )
    expect(lines).toEqual(['block line'])
  })
})
