import { isIndexFile, pairLocations } from './pairLocations.ts'

import type { FileLocation } from '@jbrowse/core/util/types'

function uri(s: string): FileLocation {
  return { uri: s, locationType: 'UriLocation' }
}

function names(pairs: ReturnType<typeof pairLocations>) {
  return pairs.map(p => ({
    file: 'uri' in p.file ? p.file.uri : '',
    index: p.index && 'uri' in p.index ? p.index.uri : undefined,
  }))
}

test('pairs bam with its .bam.bai', () => {
  const pairs = pairLocations([uri('/data/a.bam'), uri('/data/a.bam.bai')])
  expect(names(pairs)).toEqual([
    { file: '/data/a.bam', index: '/data/a.bam.bai' },
  ])
})

test('pairs bam with short-form .bai', () => {
  const pairs = pairLocations([uri('/data/a.bam'), uri('/data/a.bai')])
  expect(names(pairs)).toEqual([{ file: '/data/a.bam', index: '/data/a.bai' }])
})

test('pairs bgzipped vcf with .tbi', () => {
  const pairs = pairLocations([uri('/x/v.vcf.gz'), uri('/x/v.vcf.gz.tbi')])
  expect(names(pairs)).toEqual([
    { file: '/x/v.vcf.gz', index: '/x/v.vcf.gz.tbi' },
  ])
})

test('bigwig has no index', () => {
  const pairs = pairLocations([uri('/x/cov.bw')])
  expect(names(pairs)).toEqual([{ file: '/x/cov.bw', index: undefined }])
})

test('drops an orphan index with no matching data file', () => {
  const pairs = pairLocations([uri('/x/orphan.tbi')])
  expect(pairs).toEqual([])
})

test('keeps multiple data files distinct and does not reuse one index', () => {
  const pairs = pairLocations([
    uri('/x/a.bam'),
    uri('/x/b.bam'),
    uri('/x/a.bam.bai'),
  ])
  expect(names(pairs)).toEqual([
    { file: '/x/a.bam', index: '/x/a.bam.bai' },
    { file: '/x/b.bam', index: undefined },
  ])
})

test('matching is case-insensitive', () => {
  const pairs = pairLocations([uri('/x/A.BAM'), uri('/x/A.BAM.BAI')])
  expect(names(pairs)).toEqual([{ file: '/x/A.BAM', index: '/x/A.BAM.BAI' }])
})

test('collapses a data file repeated under the same location', () => {
  const pairs = pairLocations([
    uri('/x/a.bam'),
    uri('/x/a.bam'),
    uri('/x/a.bam.bai'),
  ])
  expect(names(pairs)).toEqual([{ file: '/x/a.bam', index: '/x/a.bam.bai' }])
})

test('isIndexFile recognizes index suffixes regardless of case', () => {
  expect(isIndexFile(uri('/x/a.bam.bai'))).toBe(true)
  expect(isIndexFile(uri('/x/a.VCF.GZ.TBI'))).toBe(true)
  expect(isIndexFile(uri('/x/cov.bw'))).toBe(false)
  expect(isIndexFile(uri('/x/a.bam'))).toBe(false)
})

test('keeps same-named data files from different directories distinct', () => {
  const pairs = pairLocations([uri('/x/a.bam'), uri('/y/a.bam')])
  expect(names(pairs)).toEqual([
    { file: '/x/a.bam', index: undefined },
    { file: '/y/a.bam', index: undefined },
  ])
})

test('pairs same-named data files in different directories with their own index', () => {
  const pairs = pairLocations([
    uri('/x/a.bam'),
    uri('/x/a.bam.bai'),
    uri('/y/a.bam'),
    uri('/y/a.bam.bai'),
  ])
  expect(names(pairs)).toEqual([
    { file: '/x/a.bam', index: '/x/a.bam.bai' },
    { file: '/y/a.bam', index: '/y/a.bam.bai' },
  ])
})

test('long-form index (.bam.bai) takes priority over short-form (.bai) when both are present', () => {
  // Verifies the Map algorithm always prefers the case-1 match (dataName+suffix)
  // over the case-2 match (stripExt(dataName)+suffix), regardless of list order.
  const pairs = pairLocations([
    uri('/x/a.bam'),
    uri('/x/a.bai'),
    uri('/x/a.bam.bai'),
  ])
  expect(names(pairs)).toEqual([{ file: '/x/a.bam', index: '/x/a.bam.bai' }])
})

test('short-form index (.bai) is still matched when no long-form is present', () => {
  const pairs = pairLocations([uri('/x/a.bam'), uri('/x/a.bai')])
  expect(names(pairs)).toEqual([{ file: '/x/a.bam', index: '/x/a.bai' }])
})

// short-form index names record nothing about what they index, so a bam and a
// vcf sharing a stem both key to "s" and the bam used to take whichever came
// first — configuring an alignments track with a tabix index
test('a bam does not take a short-form tabix index sharing its stem', () => {
  const pairs = pairLocations([
    uri('/x/s.bam'),
    uri('/x/s.tbi'),
    uri('/x/s.vcf.gz'),
  ])
  expect(names(pairs)).toEqual([
    { file: '/x/s.bam', index: undefined },
    { file: '/x/s.vcf.gz', index: undefined },
  ])
})

test('bam and cram sharing a stem each take their own short-form index', () => {
  // .crai listed first, so a first-entry-wins map hands it to the bam
  const pairs = pairLocations([
    uri('/x/s.bam'),
    uri('/x/s.crai'),
    uri('/x/s.cram'),
    uri('/x/s.bai'),
  ])
  expect(names(pairs)).toEqual([
    { file: '/x/s.bam', index: '/x/s.bai' },
    { file: '/x/s.cram', index: '/x/s.crai' },
  ])
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
  const pairs = pairLocations([uri('/x/s.bam'), uri('/x/s.bam.tbi')])
  expect(names(pairs)).toEqual([{ file: '/x/s.bam', index: '/x/s.bam.tbi' }])
})

// an extensionless data file has no kind to check against, and its index can
// only ever match in long form
test('an extensionless data file still pairs with its index', () => {
  const pairs = pairLocations([uri('/x/mydata'), uri('/x/mydata.bai')])
  expect(names(pairs)).toEqual([{ file: '/x/mydata', index: '/x/mydata.bai' }])
})
