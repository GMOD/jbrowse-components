import { searchAllGroups } from './searchIndex.ts'

// [accession, commonName, scientificName, assemblyName, assemblyStatus, source,
//  taxonId, ncbiStatus, year, rank, altAccession]
const hg38 = [
  'hg38',
  'Human',
  'Homo sapiens',
  'GRCh38',
  '',
  'ucsc',
  9606,
  0,
  2013,
  2,
  'GCA_000001405.15',
] as const
const hs1 = [
  'hs1',
  'Human',
  'Homo sapiens',
  'T2T-CHM13v2.0',
  '',
  'ucsc',
  9606,
  0,
  2022,
  1,
  '',
] as const
const hg19 = [
  'hg19',
  'Human',
  'Homo sapiens',
  'GRCh37',
  '',
  'ucsc',
  9606,
  0,
  2009,
  3,
  '',
] as const
const genArkHuman = [
  'GCA_009914755.4',
  'human T2T',
  'Homo sapiens',
  'T2T-CHM13v2.0',
  'Chromosome',
  'primates',
  9606,
  1,
  2022,
  0,
  '',
] as const
const suppressed = [
  'GCF_000004335.4',
  'giant panda',
  'Ailuropoda melanoleuca',
  'ASM433v2',
  'Chromosome',
  'uncategorized',
  9646,
  3,
  2009,
  0,
  '',
] as const

const index = [hg38, hs1, hg19, genArkHuman, suppressed].map(r => [...r])

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const search = (query: string) => searchAllGroups(index as any, query)

test('an empty query searches nothing rather than everything', () => {
  expect(search('')).toEqual([])
  expect(search('   ')).toEqual([])
})

test('rebuilds the launchable config url for each group', () => {
  const [ucsc] = search('hg38')
  expect(ucsc?.jbrowseConfig).toBe('https://jbrowse.org/ucsc/hg38/config.json')
  expect(ucsc?.jbrowseMinimalConfig).toBe(
    'https://jbrowse.org/ucsc/hg38/minimal.json',
  )

  const [genark] = search('GCA_009914755.4')
  // chunked three digits at a time, as jb2hubs lays the hubs out
  expect(genark?.jbrowseConfig).toBe(
    'https://jbrowse.org/hubs/genark/GCA/009/914/755/GCA_009914755.4/config.json',
  )
  // only UCSC dbs publish a minimal config
  expect(genark?.jbrowseMinimalConfig).toBeUndefined()
})

test('a token starting a word outranks the same letters mid-word', () => {
  // 'coli' begins a word in "Escherichia coli" but hides inside
  // "Mycolicibacterium", which is also the newer assembly — relevance has to
  // beat recency here, or a search for E. coli never finds E. coli
  const eColi = [
    'GCF_000005845.2',
    'E. coli',
    'Escherichia coli',
    'ASM584v2',
    'Complete Genome',
    'bacteria',
    562,
    1,
    2013,
    0,
    '',
  ]
  const lookalike = [
    'GCF_049241375.1',
    'Mycolicibacterium wolinskyi',
    'Mycolicibacterium wolinskyi',
    'Jessa_Mwolja_1.0',
    'Complete Genome',
    'bacteria',
    209173,
    0,
    2025,
    0,
    '',
  ]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hits = searchAllGroups([lookalike, eColi] as any, 'coli')
  expect(hits.map(r => r.accession)).toEqual([
    'GCF_000005845.2',
    'GCF_049241375.1',
  ])
})

test('leads with the assembly UCSC prefers, then the newest', () => {
  expect(search('Homo sapiens').map(r => r.accession)).toEqual([
    'hs1', // rank 1
    'hg38', // rank 2
    'hg19', // rank 3
    'GCA_009914755.4', // unranked GenArk
  ])
})

test('unranked hits fall back to newest first', () => {
  expect(search('Chromosome').map(r => r.accession)).toEqual([
    'GCA_009914755.4', // 2022
    'GCF_000004335.4', // 2009
  ])
})

test('a UCSC db is findable by the NCBI accession naming the same assembly', () => {
  expect(search('GCA_000001405').map(r => r.accession)).toEqual(['hg38'])
})

test('every token has to match, in any field', () => {
  // 'human' is in the common name, 'T2T' only in the assembly name
  expect(search('human t2t').map(r => r.accession)).toEqual([
    'hs1',
    'GCA_009914755.4',
  ])
  // tokens are ANDed, so an unmatched one rules the row out
  expect(search('human zebrafish')).toEqual([])
  // and a query nobody writes as one substring still resolves
  expect(search('sapiens GRCh37').map(r => r.accession)).toEqual(['hg19'])
})

test('unpacks the ncbiStatus bits', () => {
  const [genark] = search('GCA_009914755.4')
  expect(genark?.ncbiRefSeqCategory).toBe('reference genome')
  expect(genark?.suppressed).toBe(false)

  const [both] = search('giant panda')
  expect(both?.ncbiRefSeqCategory).toBe('reference genome')
  expect(both?.suppressed).toBe(true)

  const [neither] = search('hg38')
  expect(neither?.ncbiRefSeqCategory).toBeUndefined()
  expect(neither?.suppressed).toBe(false)
})

test('carries the group each hit came from', () => {
  expect(search('hg38')[0]?.source).toBe('ucsc')
  expect(search('GCA_009914755.4')[0]?.source).toBe('primates')
})

test('empty index fields become undefined rather than blank strings', () => {
  const [ucsc] = search('hg38')
  // UCSC rows carry no assembly status in the index
  expect(ucsc?.assemblyStatus).toBeUndefined()
  expect(ucsc?.ncbiAssemblyName).toBe('GRCh38')
})
