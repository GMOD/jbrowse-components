import { SimpleFeature } from '@jbrowse/core/util'

import { buildPairedEndMateFeature, getMateFields } from './mateFeature.ts'

function feat(data: Record<string, unknown>) {
  return new SimpleFeature({ uniqueId: 'r1', ...data })
}

test('getMateFields reads mate coords off a paired read', () => {
  expect(
    getMateFields(
      feat({
        refName: 'chr1',
        start: 100,
        end: 200,
        strand: -1,
        next_ref: 'chr2',
        next_pos: 5000,
      }),
    ),
  ).toEqual({
    uniqueId: 'r1',
    refName: 'chr1',
    start: 100,
    end: 200,
    strand: -1,
    nextRef: 'chr2',
    nextPos: 5000,
  })
})

test('getMateFields returns undefined when the mate is unmapped/absent', () => {
  expect(
    getMateFields(feat({ refName: 'chr1', start: 100, end: 200 })),
  ).toBeUndefined()
})

test('buildPairedEndMateFeature carries a distinct mate uniqueId', () => {
  const built = buildPairedEndMateFeature({
    uniqueId: 'r1',
    refName: 'chr1',
    start: 100,
    end: 200,
    strand: 1,
    nextRef: 'chr2',
    nextPos: 5000,
  })
  expect(built.id()).toBe('r1')
  const mate = built.get('mate')
  expect(mate).toEqual({
    uniqueId: 'r1-mate',
    refName: 'chr2',
    start: 5000,
    end: 5001,
    strand: 1,
  })
})
