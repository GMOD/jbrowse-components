import { getFileName } from '@jbrowse/core/util/tracks'

import { pairLocations } from './pairLocations.ts'

import type { PairedLocations } from './pairLocations.ts'
import type { FileLocation } from '@jbrowse/core/util/types'

function uri(s: string): FileLocation {
  return { uri: s, locationType: 'UriLocation' }
}

function blob(name: string, blobId: string): FileLocation {
  return { name, blobId, locationType: 'BlobLocation' }
}

function names({ pairs }: PairedLocations) {
  return pairs.map(p => ({
    file: 'uri' in p.file ? p.file.uri : '',
    index: p.index && 'uri' in p.index ? p.index.uri : undefined,
  }))
}

function orphans({ orphanIndexes }: PairedLocations) {
  return orphanIndexes.map(loc => ('uri' in loc ? loc.uri : ''))
}

test('pairs bam with its .bam.bai', () => {
  const result = pairLocations([uri('/data/a.bam'), uri('/data/a.bam.bai')])
  expect(names(result)).toEqual([
    { file: '/data/a.bam', index: '/data/a.bam.bai' },
  ])
})

test('pairs bam with short-form .bai', () => {
  const result = pairLocations([uri('/data/a.bam'), uri('/data/a.bai')])
  expect(names(result)).toEqual([{ file: '/data/a.bam', index: '/data/a.bai' }])
})

test('pairs bgzipped vcf with .tbi', () => {
  const result = pairLocations([uri('/x/v.vcf.gz'), uri('/x/v.vcf.gz.tbi')])
  expect(names(result)).toEqual([
    { file: '/x/v.vcf.gz', index: '/x/v.vcf.gz.tbi' },
  ])
})

test('bigwig has no index', () => {
  const result = pairLocations([uri('/x/cov.bw')])
  expect(names(result)).toEqual([{ file: '/x/cov.bw', index: undefined }])
})

test('drops an orphan index with no matching data file', () => {
  const result = pairLocations([uri('/x/orphan.tbi')])
  expect(result.pairs).toEqual([])
  expect(orphans(result)).toEqual(['/x/orphan.tbi'])
})

test('keeps multiple data files distinct and does not reuse one index', () => {
  const result = pairLocations([
    uri('/x/a.bam'),
    uri('/x/b.bam'),
    uri('/x/a.bam.bai'),
  ])
  expect(names(result)).toEqual([
    { file: '/x/a.bam', index: '/x/a.bam.bai' },
    { file: '/x/b.bam', index: undefined },
  ])
})

test('matching is case-insensitive', () => {
  const result = pairLocations([uri('/x/A.BAM'), uri('/x/A.BAM.BAI')])
  expect(names(result)).toEqual([{ file: '/x/A.BAM', index: '/x/A.BAM.BAI' }])
})

test('collapses a data file repeated under the same location', () => {
  const result = pairLocations([
    uri('/x/a.bam'),
    uri('/x/a.bam'),
    uri('/x/a.bam.bai'),
  ])
  expect(names(result)).toEqual([{ file: '/x/a.bam', index: '/x/a.bam.bai' }])
})

test('collapses an orphan index repeated under the same location', () => {
  expect(orphans(pairLocations([uri('/x/o.tbi'), uri('/x/o.tbi')]))).toEqual([
    '/x/o.tbi',
  ])
})

// a blob has no path and its id is minted fresh on every drop, so identity has
// to come from the name or the same file dropped twice becomes two tracks
test('collapses the same local file dropped twice', () => {
  const result = pairLocations([
    blob('a.bam', 'blob-1'),
    blob('a.bam.bai', 'blob-2'),
    blob('a.bam', 'blob-3'),
    blob('a.bam.bai', 'blob-4'),
  ])
  // which of the duplicate blobs survives is immaterial — they are the same
  // file stored twice — so this checks the pairing, not the id
  expect(result.pairs).toHaveLength(1)
  expect(getFileName(result.pairs[0]!.file)).toBe('a.bam')
  expect(getFileName(result.pairs[0]!.index!)).toBe('a.bam.bai')
  expect(result.orphanIndexes).toEqual([])
})

test('keeps same-named data files from different directories distinct', () => {
  const result = pairLocations([uri('/x/a.bam'), uri('/y/a.bam')])
  expect(names(result)).toEqual([
    { file: '/x/a.bam', index: undefined },
    { file: '/y/a.bam', index: undefined },
  ])
})

test('pairs same-named data files in different directories with their own index', () => {
  const result = pairLocations([
    uri('/x/a.bam'),
    uri('/x/a.bam.bai'),
    uri('/y/a.bam'),
    uri('/y/a.bam.bai'),
  ])
  expect(names(result)).toEqual([
    { file: '/x/a.bam', index: '/x/a.bam.bai' },
    { file: '/y/a.bam', index: '/y/a.bam.bai' },
  ])
})

test('long-form index (.bam.bai) takes priority over short-form (.bai) when both are present', () => {
  // Verifies the Map algorithm always prefers the case-1 match (dataName+suffix)
  // over the case-2 match (stripExt(dataName)+suffix), regardless of list order.
  const result = pairLocations([
    uri('/x/a.bam'),
    uri('/x/a.bai'),
    uri('/x/a.bam.bai'),
  ])
  expect(names(result)).toEqual([{ file: '/x/a.bam', index: '/x/a.bam.bai' }])
})

test('short-form index (.bai) is still matched when no long-form is present', () => {
  const result = pairLocations([uri('/x/a.bam'), uri('/x/a.bai')])
  expect(names(result)).toEqual([{ file: '/x/a.bam', index: '/x/a.bai' }])
})

// short-form index names record nothing about what they index, so a bam and a
// vcf sharing a stem both key to "s" and the bam used to take whichever came
// first — configuring an alignments track with a tabix index
test('a bam does not take a short-form tabix index sharing its stem', () => {
  const result = pairLocations([
    uri('/x/s.bam'),
    uri('/x/s.tbi'),
    uri('/x/s.vcf.gz'),
  ])
  expect(names(result)).toEqual([
    { file: '/x/s.bam', index: undefined },
    { file: '/x/s.vcf.gz', index: undefined },
  ])
})

test('bam and cram sharing a stem each take their own short-form index', () => {
  // .crai listed first, so a first-entry-wins map hands it to the bam
  const result = pairLocations([
    uri('/x/s.bam'),
    uri('/x/s.crai'),
    uri('/x/s.cram'),
    uri('/x/s.bai'),
  ])
  expect(names(result)).toEqual([
    { file: '/x/s.bam', index: '/x/s.bai' },
    { file: '/x/s.cram', index: '/x/s.crai' },
  ])
})

// every format guesser accepts \.b?gz$, so a .bgz file is as ordinary a tabix
// target as a .gz one
test('a short-form tabix index pairs with a .bgz data file', () => {
  expect(
    names(pairLocations([uri('/x/s.vcf.bgz'), uri('/x/s.vcf.tbi')])),
  ).toEqual([{ file: '/x/s.vcf.bgz', index: '/x/s.vcf.tbi' }])
})

test('a csi indexes either a bam or a bgzipped file', () => {
  expect(names(pairLocations([uri('/x/s.bam'), uri('/x/s.csi')]))).toEqual([
    { file: '/x/s.bam', index: '/x/s.csi' },
  ])
  expect(
    names(pairLocations([uri('/x/s.gff.gz'), uri('/x/s.gff.csi')])),
  ).toEqual([{ file: '/x/s.gff.gz', index: '/x/s.gff.csi' }])
})

// the long form names its data file outright, so it is honored even for a
// suffix that would not pass the short-form kind check
test('a long-form index is taken at its word', () => {
  const result = pairLocations([uri('/x/s.bam'), uri('/x/s.bam.tbi')])
  expect(names(result)).toEqual([{ file: '/x/s.bam', index: '/x/s.bam.tbi' }])
})

// an extensionless data file has no kind to check against, and its index can
// only ever match in long form
test('an extensionless data file still pairs with its index', () => {
  const result = pairLocations([uri('/x/mydata'), uri('/x/mydata.bai')])
  expect(names(result)).toEqual([{ file: '/x/mydata', index: '/x/mydata.bai' }])
})

describe('orphanIndexes', () => {
  test('an index whose kind fits nothing present is an orphan', () => {
    // .tbi cannot index a bam, so nothing here could have taken it
    expect(orphans(pairLocations([uri('/x/s.bam'), uri('/x/s.tbi')]))).toEqual([
      '/x/s.tbi',
    ])
  })

  // a bgzipped fasta wants both sidecars but LocationPair has one slot, and
  // BgzipFastaAdapter derives the pair from the fasta's own URL regardless —
  // the loser of that slot is not something to warn about
  test('a second sidecar for the same data file is not an orphan', () => {
    expect(
      orphans(
        pairLocations([
          uri('/x/g.fa.gz'),
          uri('/x/g.fa.gz.fai'),
          uri('/x/g.fa.gz.gzi'),
        ]),
      ),
    ).toEqual([])
  })

  test('a csi alongside a bai for the same bam is not an orphan', () => {
    expect(
      orphans(
        pairLocations([
          uri('/x/a.bam'),
          uri('/x/a.bam.bai'),
          uri('/x/a.bam.csi'),
        ]),
      ),
    ).toEqual([])
  })

  test('a short-form index a present data file could have taken is not an orphan', () => {
    // b.bam already took b.bam.bai, so b.bai goes unused — but it is not
    // something the user forgot to paste a data file for
    expect(
      orphans(
        pairLocations([uri('/x/b.bam'), uri('/x/b.bam.bai'), uri('/x/b.bai')]),
      ),
    ).toEqual([])
  })

  test('no data files at all means every index is an orphan', () => {
    expect(orphans(pairLocations([uri('/x/a.tbi'), uri('/x/b.bai')]))).toEqual([
      '/x/a.tbi',
      '/x/b.bai',
    ])
  })
})
