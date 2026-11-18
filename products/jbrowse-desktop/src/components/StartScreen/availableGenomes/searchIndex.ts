import { notEmpty } from '@jbrowse/core/util'

import { rankRows } from './searchScoring.ts'

import type { GenomeRow } from './getColumnDefinitions.tsx'

export const SEARCH_INDEX_URL = 'https://genomes.jbrowse.org/searchIndex.json'

/**
 * One row of searchIndex.json, built by jb2hubs/website/generateSearchIndex.ts.
 * It is an array of arrays rather than objects to avoid repeating key names
 * 50k times — the whole index is ~7.5MB for every assembly in every group.
 */
export type IndexRow = [
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
  // for a UCSC db whose organism is an abbreviated binomial, the common names
  // GenArk gives the same taxon ("fly" for dm6), matched but not shown
  aliases?: string[],
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

function toEntry(row: IndexRow): GenomeRow | undefined {
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
        id: accession,
        accession,
        commonName,
        scientificName,
        source,
        taxonId,
        assemblyStatus: assemblyStatus || undefined,
        ncbiAssemblyName: assemblyName || undefined,
        pairedAccession: altAccession || undefined,
        ncbiRefSeqCategory: ncbiStatus & 1 ? 'reference genome' : undefined,
        suppressed: Boolean(ncbiStatus & 2),
      }
    : undefined
}

/**
 * The entries for a set of accessions, from anywhere in the index. A selection
 * is keyed by accession and outlives the query that surfaced each row, so
 * launching one cannot rely on the hits the current query leaves on screen.
 */
export function entriesForAccessions(
  data: IndexRow[] | undefined,
  accessions: Set<string>,
): GenomeRow[] {
  return (data ?? [])
    .filter(row => accessions.has(row[0]))
    .map(row => toEntry(row))
    .filter(notEmpty)
}

/** Hits for `searchQuery` across every group, most relevant first */
export function searchAllGroups(
  data: IndexRow[] | undefined,
  searchQuery: string,
): GenomeRow[] {
  return rankRows(data ?? [], searchQuery)
    .map(row => toEntry(row))
    .filter(notEmpty)
}
