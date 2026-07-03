import { SimpleFeature } from '@jbrowse/core/util'

import { buildPairedEndMateFeature, getMateFields } from './mateFeature.ts'

function feat(
  data: Record<string, unknown> & {
    start: number
    end: number
    refName: string
  },
) {
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
        // paired (0x1) + mate reverse (0x20)
        flags: 0x1 | 0x20,
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
    // derived from the mate-reverse flag, not the read's own strand
    mateStrand: -1,
  })
})

test('getMateFields derives forward mate strand when mate-reverse is unset', () => {
  expect(
    getMateFields(
      feat({
        refName: 'chr1',
        start: 100,
        end: 200,
        strand: -1,
        flags: 0x1,
        next_ref: 'chr2',
        next_pos: 5000,
      }),
    )?.mateStrand,
  ).toBe(1)
})

test('getMateFields returns undefined when the mate is unmapped/absent', () => {
  expect(
    getMateFields(feat({ refName: 'chr1', start: 100, end: 200 })),
  ).toBeUndefined()
})

test('getMateFields returns undefined when the mate-unmapped flag is set', () => {
  // RNEXT/PNEXT are conventionally set to the read's own locus for a
  // mate-unmapped read, so mate actions must not be offered
  expect(
    getMateFields(
      feat({
        refName: 'chr1',
        start: 100,
        end: 200,
        // paired (0x1) + mate unmapped (0x8)
        flags: 0x1 | 0x8,
        next_ref: 'chr1',
        next_pos: 100,
      }),
    ),
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
    mateStrand: -1,
  })
  expect(built.id()).toBe('r1')
  const mate = built.get('mate')
  expect(mate).toEqual({
    uniqueId: 'r1-mate',
    refName: 'chr2',
    start: 5000,
    end: 5001,
    strand: -1,
  })
})
