import BigBedTextSearchAdapter, {
  mergeTranscripts,
} from './BigBedTextSearchAdapter.ts'
import configSchema from './configSchema.ts'

// genes.bb holds three EDEN transcripts overlapping on ctgA, two Apple
// transcripts apart on ctgA, and Banana on ctgB, extra-indexed on name (the
// accession) and name2 (the gene); genes.ix is ixIxx over the accession
// without its version, as GenArk's is, and the gene. genes.bed, genes.as and
// genes.ixin.txt rebuild them
function local(file: string) {
  return {
    localPath: require.resolve(`./test_data/${file}`),
    locationType: 'LocalPathLocation' as const,
  }
}

function adapter(withTrix: boolean) {
  return new BigBedTextSearchAdapter(
    configSchema.create({
      bigBedLocation: local('genes.bb'),
      ...(withTrix
        ? { ixFilePath: local('genes.ix'), ixxFilePath: local('genes.ixx') }
        : {}),
    }),
  )
}

const summary = async (
  withTrix: boolean,
  queryString: string,
  searchType?: 'exact',
) =>
  (await adapter(withTrix).searchIndex({ queryString, searchType })).map(r => [
    r.getLabel(),
    r.getLocation(),
    r.isExact(),
  ])

test('a gene name lands on the gene its transcripts span', async () => {
  expect(await summary(true, 'eden')).toEqual([
    ['EDEN', 'ctgA:1050..9500', true],
  ])
})

test('transcripts of one name in two places stay two places', async () => {
  expect(await summary(true, 'APPLE')).toEqual([
    ['Apple', 'ctgA:17400..23000', true],
    ['Apple', 'ctgA:30001..32000', true],
  ])
})

test('an accession finds its own transcript, in any case', async () => {
  expect(await summary(true, 'nm_0004.1')).toEqual([
    ['NM_0004.1', 'ctgB:1001..2000', true],
  ])
})

test('an accession without its version finds every version', async () => {
  expect(await summary(true, 'nm_0001')).toEqual([
    ['NM_0001.1', 'ctgA:1050..9000', true],
    ['NM_0001.2', 'ctgA:1050..9000', true],
    ['NM_0001.3', 'ctgA:1300..9500', true],
  ])
})

test('a word the query only prefixes lands where its exact word would', async () => {
  expect(await summary(true, 'ed')).toEqual([
    ['EDEN', 'ctgA:1050..9500', false],
  ])
  expect(await summary(true, 'ap')).toEqual([
    ['Apple', 'ctgA:17400..23000', false],
    ['Apple', 'ctgA:30001..32000', false],
  ])
})

test('an exact search resolves no prefixes', async () => {
  expect(await summary(true, 'ed', 'exact')).toEqual([])
})

test('a name the trix has no word for still matches exactly as typed', async () => {
  const a = adapter(true)
  a.trix = { search: async () => [] } as unknown as typeof a.trix
  expect(
    (await a.searchIndex({ queryString: 'NM_0004.1' })).map(r => [
      r.getLabel(),
      r.getLocation(),
    ]),
  ).toEqual([['NM_0004.1', 'ctgB:1001..2000']])
})

test('without a trix index a name matches exactly as typed', async () => {
  expect(await summary(false, 'Banana')).toEqual([
    ['Banana', 'ctgB:1001..2000', true],
  ])
  expect(await summary(false, 'banana')).toEqual([])
})

test('mergeTranscripts joins overlap, not adjacency across a gap', () => {
  expect(
    mergeTranscripts([
      { label: 'A', refName: 'c', start: 10, end: 20 },
      { label: 'A', refName: 'c', start: 0, end: 12 },
      { label: 'A', refName: 'c', start: 21, end: 30 },
      { label: 'A', refName: 'd', start: 0, end: 5 },
    ]),
  ).toEqual([
    { label: 'A', refName: 'c', start: 0, end: 20 },
    { label: 'A', refName: 'c', start: 21, end: 30 },
    { label: 'A', refName: 'd', start: 0, end: 5 },
  ])
})
