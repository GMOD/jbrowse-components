import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import { exportedReads } from './exportedReads.ts'

// what CoreGetFeatures hands the main thread: a read's toJSON, revived
function read(name: string, fields: Record<string, unknown> = {}) {
  return new SimpleFeature({
    uniqueId: name,
    refName: 'ctgA',
    start: 100,
    end: 200,
    name,
    flags: 0,
    score: 60,
    CIGAR: '100M',
    tags: {},
    ...fields,
  })
}

const names = (features: { get: (f: string) => unknown }[]) =>
  features.map(f => f.get('name'))

test('the default flag filter drops what the pileup hides', () => {
  expect(
    names(
      exportedReads(
        [
          read('kept'),
          read('duplicate', { flags: 1024 }),
          read('unmapped', { flags: 4 }),
        ],
        [
          { field: 'flags.UNMAP', equal: false },
          { field: 'flags.DUP', equal: false },
        ],
      ),
    ),
  ).toEqual(['kept'])
})

test('a mapq floor, a tag and spliced read the serialized fields', () => {
  const reads = [
    read('kept', { tags: { HP: 1 } }),
    read('low', { score: 5, tags: { HP: 1 } }),
    read('otherHaplotype', { tags: { HP: 2 } }),
    read('spliced', { CIGAR: '50M1000N50M', tags: { HP: 1 } }),
  ]
  expect(
    names(
      exportedReads(reads, [
        { field: 'mapq', gte: 20 },
        { field: 'tags.HP', equal: 1 },
        { field: 'spliced', equal: false },
      ]),
    ),
  ).toEqual(['kept'])
})

test('no filter keeps every read', () => {
  expect(names(exportedReads([read('a'), read('b')], []))).toEqual(['a', 'b'])
})
