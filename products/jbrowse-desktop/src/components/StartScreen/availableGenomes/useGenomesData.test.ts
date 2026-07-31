import { applyRowFilters, filterGenomes, groupRows } from './useGenomesData.ts'

import type { Entry } from './getColumnDefinitions.tsx'

function entry(props: Partial<Entry> & { accession: string }): Entry {
  return {
    commonName: '',
    scientificName: '',
    taxonId: 0,
    jbrowseConfig: `https://example.com/${props.accession}/config.json`,
    ...props,
  }
}

// A UCSC main-genome row and a GenArk row, i.e. the two disjoint halves of Entry
const hg38 = entry({
  accession: 'hg38',
  name: 'hg38',
  organism: 'Human',
  description: 'Dec. 2013 (GRCh38/hg38)',
  sourceName:
    'GRCh38 Genome Reference Consortium Human Reference 38 (GCA_000001405.15)',
  scientificName: 'Homo sapiens',
  commonName: 'Human',
  taxonId: 9606,
  orderKey: 1,
})
const panda = entry({
  accession: 'GCF_000004335.4',
  commonName: 'giant panda',
  scientificName: 'Ailuropoda melanoleuca',
  ncbiName: 'GCF_000004335.4_ASM433v2',
  ncbiAssemblyName: 'ASM433v2',
  ncbiRefSeqCategory: 'reference genome',
  assemblyStatus: 'Chromosome',
  submitterOrg: 'Shenzhen Institutes',
  pairedAccession: 'GCA_000004335.4',
  taxonId: 9646,
})
const genbankOnly = entry({
  accession: 'GCA_000001.1',
  commonName: 'nothing much',
  ncbiName: 'GCA_000001.1_asm',
  taxonId: 4321,
})
const defaults = {
  searchQuery: '',
  filterOption: 'all' as const,
  showOnlyFavs: false,
  favoriteIds: new Set<string>(),
}

test('drops rows with no accession, since it keys selection and favorites', () => {
  const rows = groupRows([hg38, entry({ accession: '' })])
  expect(rows.map(r => r.accession)).toEqual(['hg38'])
})

test('orders by UCSC orderKey, leaving orderKey-less groups alone', () => {
  const b = entry({ accession: 'b', orderKey: 2 })
  const a = entry({ accession: 'a', orderKey: 10 })
  expect(groupRows([a, b]).map(r => r.accession)).toEqual(['b', 'a'])
  expect(groupRows([panda, genbankOnly]).map(r => r.accession)).toEqual([
    'GCF_000004335.4',
    'GCA_000001.1',
  ])
})

test('sorting a group does not mutate the fetched array', () => {
  const data = [
    entry({ accession: 'a', orderKey: 10 }),
    entry({ accession: 'b', orderKey: 2 }),
  ]
  groupRows(data)
  expect(data.map(r => r.accession)).toEqual(['a', 'b'])
})

test('search matches fields only one of the two groups supplies', () => {
  const rows = [hg38, panda]
  const matching = (searchQuery: string) =>
    filterGenomes({ ...defaults, rows, searchQuery }).map(r => r.accession)

  expect(matching('GRCh38')).toEqual(['hg38']) // UCSC description
  expect(matching('ASM433v2')).toEqual(['GCF_000004335.4']) // NCBI assembly name
  expect(matching('Chromosome')).toEqual(['GCF_000004335.4']) // assembly status
  expect(matching('shenzhen')).toEqual(['GCF_000004335.4']) // submitter
  expect(matching('GCF_000004335')).toEqual(['GCF_000004335.4']) // accession
  expect(matching('  HUMAN ')).toEqual(['hg38']) // trimmed, case-insensitive
})

test('search finds an assembly by the other authority accession', () => {
  const rows = [hg38, panda]
  const matching = (searchQuery: string) =>
    filterGenomes({ ...defaults, rows, searchQuery }).map(r => r.accession)

  // hg38 records GCA_000001405.15 only inside its UCSC sourceName
  expect(matching('GCA_000001405')).toEqual(['hg38'])
  // the GCF panda entry is reachable by its paired GCA accession
  expect(matching('GCA_000004335.4')).toEqual(['GCF_000004335.4'])
})

test('every token has to match, in any field', () => {
  const rows = [hg38, panda]
  const matching = (searchQuery: string) =>
    filterGenomes({ ...defaults, rows, searchQuery }).map(r => r.accession)

  // 'giant' is the common name, 'melanoleuca' the scientific one
  expect(matching('giant melanoleuca')).toEqual(['GCF_000004335.4'])
  expect(matching('human GRCh38')).toEqual(['hg38'])
  expect(matching('human panda')).toEqual([])
})

test('search does not match the fields a group omits', () => {
  // Array.join renders a missing field as '', so 'undefined' must match nothing
  expect(
    filterGenomes({
      ...defaults,
      rows: [hg38, panda],
      searchQuery: 'undefined',
    }),
  ).toEqual([])
})

test('NCBI status filters key on the accession, which UCSC db names never match', () => {
  const rows = [hg38, panda, genbankOnly]
  const withFilter = (
    filterOption: Parameters<typeof filterGenomes>[0]['filterOption'],
  ) => filterGenomes({ ...defaults, rows, filterOption }).map(r => r.accession)

  expect(withFilter('all')).toEqual(['hg38', 'GCF_000004335.4', 'GCA_000001.1'])
  expect(withFilter('refseq')).toEqual(['GCF_000004335.4'])
  expect(withFilter('genbank')).toEqual(['GCA_000001.1'])
  expect(withFilter('designatedReference')).toEqual(['GCF_000004335.4'])
})

// search-index rows carry an accession and ncbiRefSeqCategory but no ncbiName,
// so a status filter reading ncbiName would silently match nothing in the
// cross-group results the index feeds
test('status filters work on rows that have no ncbiName', () => {
  const indexed = [
    entry({
      accession: 'GCF_000004335.4',
      ncbiRefSeqCategory: 'reference genome',
    }),
    entry({ accession: 'GCA_000001.1' }),
    entry({ accession: 'hg38' }),
  ]
  const withFilter = (
    filterOption: Parameters<typeof applyRowFilters>[0]['filterOption'],
  ) =>
    applyRowFilters({
      rows: indexed,
      filterOption,
      showOnlyFavs: false,
      favoriteIds: new Set<string>(),
    }).map(r => r.accession)

  expect(withFilter('refseq')).toEqual(['GCF_000004335.4'])
  expect(withFilter('genbank')).toEqual(['GCA_000001.1'])
  expect(withFilter('designatedReference')).toEqual(['GCF_000004335.4'])
})

test('applyRowFilters applies favorites without searching', () => {
  expect(
    applyRowFilters({
      rows: [hg38, panda],
      filterOption: 'all',
      showOnlyFavs: true,
      favoriteIds: new Set(['hg38']),
    }).map(r => r.accession),
  ).toEqual(['hg38'])
})

test('favorites filter keys on accession', () => {
  expect(
    filterGenomes({
      ...defaults,
      rows: [hg38, panda],
      showOnlyFavs: true,
      favoriteIds: new Set(['GCF_000004335.4']),
    }).map(r => r.accession),
  ).toEqual(['GCF_000004335.4'])
})

test('filters compose', () => {
  const compose = (favoriteIds: Set<string>) =>
    filterGenomes({
      ...defaults,
      rows: [hg38, panda, genbankOnly],
      searchQuery: 'a',
      filterOption: 'refseq',
      showOnlyFavs: true,
      favoriteIds,
    }).map(r => r.accession)

  expect(compose(new Set(['GCF_000004335.4']))).toEqual(['GCF_000004335.4'])
  // the search and the refseq filter both leave panda; favorites still applies
  expect(compose(new Set(['hg38']))).toEqual([])
})
