import { notEmpty } from '@jbrowse/core/util'

import {
  countWordStartMatches,
  matchesAllTokens,
  searchTokens,
} from './searchTokens.ts'

import type { Entry } from './getColumnDefinitions.tsx'

export const SEARCH_INDEX_URL = 'https://genomes.jbrowse.org/searchIndex.json'

/**
 * One row of searchIndex.json, built by jb2hubs/website/generateSearchIndex.ts.
 * It is an array of arrays rather than objects to avoid repeating key names
 * 50k times — the whole index is ~7.5MB for every assembly in every group.
 */
type IndexRow = [
  accession: string,
  commonName: string,
  scientificName: string,
  assemblyName: string,
  assemblyStatus: string,
  source: string,
  taxonId: number,
  // bit 0 = NCBI designated reference, bit 1 = RefSeq suppressed
  ncbiStatus: number,
  year: number,
  // UCSC's preference within the species (1 = the db it lists first, e.g. hs1
  // for human); 0 for the GenArk rows, which UCSC does not rank
  rank: number,
  // for a UCSC db, the GC[AF] accession naming the same assembly at NCBI
  altAccession: string,
]

// jb2hubs' accessionChunks: GCF_000951035.1 -> GCF/000/951/035
function accessionChunks(accession: string) {
  const [base, rest] = accession.split('_')
  const matches = rest?.match(/.{1,3}/g)
  return base && matches && matches.length >= 3
    ? { base, b1: matches[0], b2: matches[1], b3: matches[2] }
    : undefined
}

/**
 * The index records no config url, so it is rebuilt from the accession here.
 * Verified against every row of the live ucsc/primates/bacteria lists (23321 of
 * 23321) to reproduce the jbrowseConfig those group files ship, which is what
 * lets a hit launch without first fetching its group.
 */
function configUrls(accession: string, isUcsc: boolean) {
  const chunks = isUcsc ? undefined : accessionChunks(accession)
  return isUcsc
    ? {
        jbrowseConfig: `https://jbrowse.org/ucsc/${accession}/config.json`,
        jbrowseMinimalConfig: `https://jbrowse.org/ucsc/${accession}/minimal.json`,
      }
    : chunks
      ? {
          jbrowseConfig: `https://jbrowse.org/hubs/genark/${chunks.base}/${chunks.b1}/${chunks.b2}/${chunks.b3}/${accession}/config.json`,
        }
      : undefined
}

function toEntry(row: IndexRow): Entry | undefined {
  const [
    accession,
    commonName,
    scientificName,
    assemblyName,
    assemblyStatus,
    source,
    taxonId,
    ncbiStatus,
    ,
    ,
    altAccession,
  ] = row
  const urls = configUrls(accession, source === 'ucsc')
  return urls
    ? {
        ...urls,
        accession,
        commonName,
        scientificName,
        source,
        taxonId,
        assemblyStatus: assemblyStatus || undefined,
        ncbiAssemblyName: assemblyName || undefined,
        pairedAccession: altAccession || undefined,
        // eslint-disable-next-line no-bitwise
        ncbiRefSeqCategory: ncbiStatus & 1 ? 'reference genome' : undefined,
        // eslint-disable-next-line no-bitwise
        suppressed: Boolean(ncbiStatus & 2),
      }
    : undefined
}

// The same fields the group-scoped search covers, so a query does not quietly
// mean something different in the two modes: accession, common and scientific
// name, assembly name, assembly status, and the alias accession. The group
// itself is deliberately not searched — it is a filter, and its column shows a
// title the index does not carry.
function haystack(row: IndexRow) {
  return `${row[0]} ${row[1]} ${row[2]} ${row[3]} ${row[4]} ${row[10]}`
}

// Most word-start matches first (so "e coli" leads with E. coli rather than
// Mycolicibacterium), then the dbs UCSC ranks — which puts hs1, hg38, hg19
// ahead of an arbitrary GenArk human assembly — then newest, since assemblies
// are overwhelmingly disambiguated by year.
function rank(row: IndexRow) {
  return row[9] === 0 ? Infinity : row[9]
}

interface ScoredRow {
  row: IndexRow
  score: number
}

function byRelevance(a: ScoredRow, b: ScoredRow) {
  return a.score !== b.score
    ? b.score - a.score
    : rank(a.row) === rank(b.row)
      ? b.row[8] - a.row[8]
      : rank(a.row) - rank(b.row)
}

/**
 * The entries for a set of accessions, from anywhere in the index. A selection
 * is keyed by accession and outlives the query that surfaced each row, so
 * launching one cannot rely on the hits the current query leaves on screen.
 */
export function entriesForAccessions(
  data: IndexRow[] | undefined,
  accessions: Set<string>,
): Entry[] {
  return (data ?? [])
    .filter(row => accessions.has(row[0]))
    .map(row => toEntry(row))
    .filter(notEmpty)
}

/**
 * Hits for `searchQuery` across every group, most relevant first. Filters the
 * raw tuples and only scores and builds objects for what matched, so a
 * keystroke does not walk 50k rows more than once.
 */
export function searchAllGroups(
  data: IndexRow[] | undefined,
  searchQuery: string,
): Entry[] {
  const tokens = searchTokens(searchQuery)
  return tokens.length
    ? (data ?? [])
        .filter(row => matchesAllTokens(haystack(row), tokens))
        .map(row => ({
          row,
          score: countWordStartMatches(haystack(row), tokens),
        }))
        .toSorted(byRelevance)
        .map(({ row }) => toEntry(row))
        .filter(notEmpty)
    : []
}
