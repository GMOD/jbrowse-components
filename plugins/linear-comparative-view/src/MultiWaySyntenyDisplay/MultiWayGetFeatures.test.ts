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
