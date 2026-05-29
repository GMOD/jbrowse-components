import { pairLocations } from './pairLocations.ts'

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
  expect(names(pairs)).toEqual([{ file: '/data/a.bam', index: '/data/a.bam.bai' }])
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
