import { matchFormat } from '@jbrowse/add-track-core'

import {
  adapterConfigFromSpec,
  guessTrackConfFromTable,
  localIndexNeed,
  makeIndex,
} from './formatGuessers.ts'

// An account picked in the file selector with no `domains` to match by: the
// index derived without its id was read unauthenticated and failed with a 401
test('a derived index keeps the internet account its file was picked with', () => {
  const bam = {
    locationType: 'UriLocation' as const,
    uri: 'https://private.example/reads.bam',
    internetAccountId: 'labAccount',
  }
  const spec = matchFormat('reads.bam')?.spec
  expect(spec && adapterConfigFromSpec(spec, bam)).toMatchObject({
    index: {
      location: {
        uri: 'https://private.example/reads.bam.bai',
        internetAccountId: 'labAccount',
      },
    },
  })
})

test('a derived index keeps a baseUri, and a Blob has no sibling', () => {
  expect(
    makeIndex(
      { locationType: 'UriLocation', uri: 'a.vcf.gz', baseUri: 'https://h/' },
      '.tbi',
    ),
  ).toEqual({
    locationType: 'UriLocation',
    uri: 'a.vcf.gz.tbi',
    baseUri: 'https://h/',
  })
  const blob = { locationType: 'BlobLocation' as const, name: 'a', blobId: 'b' }
  expect(makeIndex(blob, '.tbi')).toBe(blob)
})

const localFile = (name: string) => ({
  locationType: 'BlobLocation' as const,
  name,
  blobId: `b-${name}`,
})
const url = (uri: string) => ({ locationType: 'UriLocation' as const, uri })

// A Blob has no sibling, so the index used to be the data file itself, and the
// adapter failed with "Not a BAI file"
test('a local BAM or CRAM with no index needs one chosen', () => {
  expect(localIndexNeed(localFile('reads.bam'), undefined)).toEqual({
    kind: 'required',
    adapterType: 'BamAdapter',
    suffix: '.bai',
  })
  expect(localIndexNeed(localFile('reads.cram'), undefined)).toEqual({
    kind: 'required',
    adapterType: 'CramAdapter',
    suffix: '.crai',
  })
  expect(
    localIndexNeed(localFile('reads.bam'), localFile('reads.bam.bai')),
  ).toBe(undefined)
  expect(localIndexNeed(url('https://h/reads.bam'), undefined)).toBe(undefined)
  expect(localIndexNeed(localFile('calls.bw'), undefined)).toBe(undefined)
})

test.each([
  ['calls.vcf.gz', 'VcfAdapter', 'vcfLocation'],
  ['genes.gff3.gz', 'Gff3Adapter', 'gffLocation'],
  ['genes.gtf.gz', 'GtfAdapter', 'gtfLocation'],
  ['peaks.bed.gz', 'BedAdapter', 'bedLocation'],
  ['cov.bedgraph.gz', 'BedGraphAdapter', 'bedGraphLocation'],
])(
  'a local %s with no index is read whole by %s',
  (name, adapterType, locField) => {
    const file = localFile(name)
    expect(guessTrackConfFromTable(file)?.adapter).toEqual({
      type: adapterType,
      [locField]: file,
    })
    expect(localIndexNeed(file, undefined)).toEqual({
      kind: 'wholeFile',
      adapterType,
    })
  },
)

test('a local tabix file keeps its tabix adapter given an index, a URL keeps it always', () => {
  const index = localFile('calls.vcf.gz.tbi')
  expect(
    guessTrackConfFromTable(localFile('calls.vcf.gz'), index)?.adapter,
  ).toEqual({
    type: 'VcfTabixAdapter',
    vcfGzLocation: localFile('calls.vcf.gz'),
    index: { location: index, indexType: 'TBI' },
  })
  expect(
    guessTrackConfFromTable(url('https://h/calls.vcf.gz'))?.adapter.type,
  ).toBe('VcfTabixAdapter')
})

test('naming the tabix adapter for a local file asks for its index', () => {
  const file = localFile('calls.vcf.gz')
  expect(
    guessTrackConfFromTable(file, undefined, 'VcfTabixAdapter')?.adapter.type,
  ).toBe('VcfTabixAdapter')
  expect(localIndexNeed(file, undefined, 'VcfTabixAdapter')).toEqual({
    kind: 'required',
    adapterType: 'VcfTabixAdapter',
    suffix: '.tbi',
  })
})
