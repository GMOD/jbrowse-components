import { CIGAR_D, CIGAR_I, CIGAR_M } from '@jbrowse/cigar-utils'
import { SimpleFeature } from '@jbrowse/core/util'

import { liftAlignmentOps, multiWayFeaturesOf } from './MultiWayGetFeatures.ts'

test('a deletion spanning the window leaves as a deletion of its lane, never a placement', () => {
  const { features, deletions } = multiWayFeaturesOf(
    liftAlignmentOps([
      new SimpleFeature({
        uniqueId: 'r1:105000-120000/spanned',
        refName: 'chr1',
        start: 101_000,
        end: 1_301_000,
        spansWindow: true,
        mate: {
          assemblyName: 'HG01123.1',
          refName: 'CM089081.1',
          start: 6000,
          end: 6000,
        },
      }),
      new SimpleFeature({
        uniqueId: 'r2',
        refName: 'chr1',
        start: 0,
        end: 10,
        mate: { assemblyName: 'HG00097.1', refName: 'c', start: 0, end: 10 },
      }),
    ]),
  )
  expect(features.map(f => f.id())).toEqual(['r2'])
  expect(deletions).toEqual([
    {
      assemblyName: 'HG01123.1',
      refName: 'CM089081.1',
      at: 6000,
      bp: 1_200_000,
    },
  ])
})

test('features leave plain, and each piece takes only its own ops', () => {
  const record = Uint32Array.from([1, 2, 3, 4, 5, 6])
  const piece = (id: string, from: number, to: number) =>
    new SimpleFeature({
      uniqueId: id,
      refName: 'chr1',
      start: from,
      end: to,
      alignmentOps: record.subarray(from, to),
    })
  const { features, ops } = liftAlignmentOps([
    piece('a', 0, 2),
    piece('b', 2, 6),
    new SimpleFeature({ uniqueId: 'c', refName: 'chr1', start: 0, end: 1 }),
  ])
  for (const feature of features) {
    expect(feature).not.toHaveProperty('alignmentOps')
  }
  expect(ops.map(([id, packed]) => [id, [...packed]])).toEqual([
    ['a', [1, 2]],
    ['b', [3, 4, 5, 6]],
  ])
  expect(ops.map(([, packed]) => packed.buffer.byteLength)).toEqual([8, 16])
})

const op = (len: number, code: number) => (len << 4) | code

test("a piece ending on an indel beside its gap leaves without it, so the gap holds the indel's bases", () => {
  const { features, ops } = liftAlignmentOps([
    new SimpleFeature({
      uniqueId: 'r/0',
      syntenyId: 's/0',
      refName: 'chr7',
      start: 1000,
      end: 1100,
      strand: 1,
      mate: { assemblyName: 'HG02055.1', refName: 'c', start: 500, end: 613 },
      alignmentOps: Uint32Array.from([op(100, CIGAR_M), op(13, CIGAR_I)]),
    }),
  ])
  expect(features).toEqual([
    expect.objectContaining({
      uniqueId: 'r/0',
      syntenyId: 's/0',
      start: 1000,
      end: 1100,
      mate: { assemblyName: 'HG02055.1', refName: 'c', start: 500, end: 600 },
    }),
  ])
  expect(ops.map(([id, packed]) => [id, [...packed]])).toEqual([
    ['r/0', [op(100, CIGAR_M)]],
  ])
})

test('a piece holding a gap the lanes open leaves as one piece per run, numbered', () => {
  const { features, ops } = liftAlignmentOps([
    new SimpleFeature({
      uniqueId: 'r',
      syntenyId: 's',
      refName: 'chr7',
      start: 0,
      end: 20_200,
      strand: 1,
      mate: { assemblyName: 'HG02055.1', refName: 'c', start: 0, end: 200 },
      alignmentOps: Uint32Array.from([
        op(100, CIGAR_M),
        op(20_000, CIGAR_D),
        op(100, CIGAR_M),
      ]),
    }),
  ])
  expect(
    features.map(({ uniqueId, syntenyId, start, end, mate }) => ({
      uniqueId,
      syntenyId,
      start,
      end,
      mate: mate && [mate.start, mate.end],
    })),
  ).toEqual([
    { uniqueId: 'r/0', syntenyId: 's/0', start: 0, end: 100, mate: [0, 100] },
    {
      uniqueId: 'r/1',
      syntenyId: 's/1',
      start: 20_100,
      end: 20_200,
      mate: [100, 200],
    },
  ])
  expect(ops.map(([id]) => id)).toEqual(['r/0', 'r/1'])
})
