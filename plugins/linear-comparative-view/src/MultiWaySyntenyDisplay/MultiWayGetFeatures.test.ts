import { SimpleFeature } from '@jbrowse/core/util'

import { liftAlignmentOps } from './MultiWayGetFeatures.ts'

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
