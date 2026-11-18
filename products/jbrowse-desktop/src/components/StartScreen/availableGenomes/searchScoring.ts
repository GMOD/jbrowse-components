import { parseSearchQuery } from '@jbrowse/core/util/searchText'

import type { IndexRow } from './searchIndex.ts'

// Ported from jb2hubs website/src/components/searchScoring.ts, which ranks the
// same searchIndex.json for genomes.jbrowse.org, so a query orders its hits the
// same way in Desktop as on the site. Keep the two in step.

const IS_REFERENCE = 1

function scoreTerm(term: string, field: string) {
  return field.startsWith(term)
    ? 3
    : field.includes(` ${term}`)
      ? 2
      : field.includes(term)
        ? 1
        : 0
}

// GenArk common names carry a parenthetical naming the assembly and year:
// "human (GRCh38.p14 2022)"
function bareCommonName(commonName: string) {
  return commonName.split('(')[0]!.trim()
}

function commonNameLabel(commonName: string) {
  const open = commonName.indexOf('(')
  return open === -1 ? '' : commonName.slice(open + 1).replace(/\)\s*$/, '')
}

// The GenBank and RefSeq accessions of one genome differ only in their prefix,
// and a UCSC db records whichever one its sourceName carried (hg38 is
// GCA_000001405.15, the GenArk row for the same genome GCF_000001405.40), so
// matching on the prefixless digits makes either query find both.
function withoutAccessionPrefix(text: string) {
  return text.replaceAll(/gc[af]_/g, '')
}

function recency(year: number) {
  return year ? Math.min(1, Math.max(0, (year - 1995) / 35)) : 0
}

/**
 * Tiebreakers between equally-matching rows, each band an order of magnitude
 * below the one above, all well under 1 so they never outrank a better textual
 * match:
 * - the least cluttered common name, so "human" beats "human papillomavirus"
 * - a UCSC db, whose browser opens with that genome's whole track catalog,
 *   above an NCBI designated reference; both above recency, or the 2024 HPRC
 *   haplotypes bury hg38
 * - newer assemblies: mm39 over mm7
 * - more complete GenArk assemblies
 * - UCSC's own order between same-year dbs of a species
 */
function tiebreak(row: IndexRow, bareName: string) {
  const status = row[4].toLowerCase()
  return (
    0.5 / (1 + bareName.length) +
    (row[5] === 'ucsc' ? 0.06 : 0) +
    (row[7] & IS_REFERENCE ? 0.03 : 0) +
    0.02 * recency(row[8]) +
    (status === 'chromosome'
      ? 0.002
      : status === 'complete genome'
        ? 0.001
        : 0) +
    (row[9] ? 0.0005 / row[9] : 0)
  )
}

// What scoring reads off a row, lowercased and joined once per index rather
// than once per row per keystroke
interface Searchable {
  row: IndexRow
  commonName: string
  // names the index borrowed for a UCSC db ("fly" for dm6), matched like the
  // common name
  aliases: string[]
  scientificName: string
  // with the common name's parenthetical, which names the assembly and year
  assemblyName: string
  accessionText: string
  // accessionText with a space at each end, so a whole token is a substring
  accessionTokens: string
  all: string
  bonus: number
}

function prepare(row: IndexRow): Searchable {
  const commonName = row[1].toLowerCase()
  const aliases = (row[11] ?? []).map(name => name.toLowerCase())
  const scientificName = row[2].toLowerCase()
  const assemblyName = row[3].toLowerCase()
  const bare = bareCommonName(commonName)
  const label = commonNameLabel(commonName)
  const accessions = `${row[0]} ${row[10]}`.toLowerCase().trim()
  const accessionText = `${accessions} ${withoutAccessionPrefix(accessions)}`
  return {
    row,
    commonName: bare,
    aliases,
    scientificName,
    assemblyName: label ? `${assemblyName} ${label}` : assemblyName,
    accessionText,
    accessionTokens: ` ${accessionText} `,
    all: `${accessionText} ${commonName} ${aliases.join(' ')} ${scientificName} ${assemblyName}`,
    bonus: tiebreak(row, aliases[0] ? bareCommonName(aliases[0]) : bare),
  }
}

interface Term {
  text: string
  accession: string
  exclude: boolean
}

// A bare `gcf_` strips to nothing, and an empty term is a substring of every
// row, so it is not a term at all
function prepareTerms(searchQuery: string): Term[] {
  return parseSearchQuery(searchQuery)
    .map(({ text, exclude }) => ({
      text,
      accession: withoutAccessionPrefix(text),
      exclude,
    }))
    .filter(term => term.accession !== '')
}

function scoreNames(term: string, s: Searchable) {
  return Math.max(
    scoreTerm(term, s.commonName),
    ...s.aliases.map(name => scoreTerm(term, name)),
  )
}

// The best field per term rather than a sum, so incidental matches in several
// fields earn nothing. The scientific name weighs as much as the common name,
// since genus names get typed as often and weighting the common name higher put
// viruses named after a host above the host. A whole accession outranks one it
// is a prefix of: GCA_000001405.1 is hg19, and would otherwise tie hg38's .15.
// A query that only excludes ranks what it leaves by the tiebreak alone.
function score(s: Searchable, asked: Term[], excluded: Term[]) {
  return asked.every(t => s.all.includes(t.accession)) &&
    !excluded.some(t => s.all.includes(t.accession))
    ? asked.reduce(
        (total, { text, accession }) =>
          total +
          Math.max(
            scoreNames(text, s) * 4,
            scoreTerm(text, s.scientificName) * 4,
            s.accessionTokens.includes(` ${accession} `)
              ? 8
              : scoreTerm(accession, s.accessionText) * 2,
            scoreTerm(text, s.assemblyName),
          ),
        s.bonus,
      )
    : -1
}

const prepared = new WeakMap<IndexRow[], Searchable[]>()

function searchable(index: IndexRow[]) {
  const cached = prepared.get(index)
  const rows = cached ?? index.map(prepare)
  if (!cached) {
    prepared.set(index, rows)
  }
  return rows
}

/**
 * Best-first rows of the index matching every term the query asks for and
 * none it excludes; a query with no terms finds nothing
 */
export function rankRows(index: IndexRow[], searchQuery: string) {
  const terms = prepareTerms(searchQuery)
  const asked = terms.filter(term => !term.exclude)
  const excluded = terms.filter(term => term.exclude)
  return terms.length
    ? searchable(index)
        .map(s => ({ row: s.row, score: score(s, asked, excluded) }))
        .filter(s => s.score >= 0)
        .toSorted((a, b) => b.score - a.score)
        .map(s => s.row)
    : []
}
