import { openFeatureWidget } from '@jbrowse/core/util'

import { makePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import { INTERBASE_SOFTCLIP } from '../../shared/types.ts'
import { openCigarWidget, openIndicatorWidget } from './detailWidgets.ts'

import type { CigarHitResult } from '../../shared/hitTestTypes.ts'

jest.mock('@jbrowse/core/util', () => ({
  ...jest.requireActual('@jbrowse/core/util'),
  openFeatureWidget: jest.fn(),
}))

function opened(hit: Omit<CigarHitResult, 'index'>) {
  jest.mocked(openFeatureWidget).mockClear()
  openCigarWidget({}, { index: 0, ...hit }, 'chr1')
  return jest.mocked(openFeatureWidget).mock.calls[0]![1]
}

// An insertion consumes no reference, so a 50 bp one at 100 opens as a point
// at 100 with its length stated, not as chr1:101..150.
test('an insertion or clip opens with an empty reference span', () => {
  for (const type of ['insertion', 'softclip', 'hardclip'] as const) {
    expect(opened({ type, position: 100, length: 50 })).toMatchObject({
      start: 100,
      end: 100,
      length: 50,
    })
  }
  expect(opened({ type: 'insertion', position: 100, length: 1 })).toMatchObject(
    { start: 100, end: 100, length: 1 },
  )
})

test('a deletion or skip spans the reference bases it removes', () => {
  expect(opened({ type: 'deletion', position: 100, length: 50 })).toMatchObject(
    { start: 100, end: 150, length: 50 },
  )
  const mismatch = opened({ type: 'mismatch', position: 100, length: 1 })
  expect(mismatch).toMatchObject({ start: 100, end: 101 })
  expect(mismatch).not.toHaveProperty('length')
})

// A right clip at the edge of a heterozygous deletion: 40x on its left flank,
// 20x inside. The depth row states the count's own denominator, and the
// column opens as a point like the per-read clip widget does.
test('the indicator widget reports the depth its count is out of', () => {
  jest.mocked(openFeatureWidget).mockClear()
  openIndicatorWidget(
    {},
    { type: 'indicator', position: 101, indicatorType: 'softclip' },
    'chr1',
    makePileupDataResult({
      coverageStartPos: 100,
      coverageDepths: new Float32Array([40, 20]),
      interbasePositions: new Uint32Array([101, 101]),
      interbaseLengths: new Uint32Array([30, 30]),
      interbaseTypes: new Uint8Array([INTERBASE_SOFTCLIP, INTERBASE_SOFTCLIP]),
      interbaseReadIndices: new Uint32Array([0, 1]),
      interbaseSequences: ['', ''],
      numSoftclips: 2,
    }),
  )
  expect(jest.mocked(openFeatureWidget).mock.calls[0]![1]).toMatchObject({
    start: 101,
    end: 101,
    length: '30bp',
    depth: 40,
    count: expect.stringMatching(/^2\/40/),
  })
})
