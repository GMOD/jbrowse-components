import { toLocale } from '../../util/index.ts'
import {
  codingLength,
  serializedIsoformReader,
} from '../../util/isoformRank.ts'

import type { SimpleFeatureSerialized } from '../../util/index.ts'

export interface SubfeatureMember {
  feature: SimpleFeatureSerialized
  /** the same subfeature before any `formatDetails` callback ran */
  unformatted?: SimpleFeatureSerialized
}

export interface SubfeatureGroup {
  type: string
  /** in transcription order: 5′ to 3′ on the parent's strand */
  members: SubfeatureMember[]
  /** attributes every member carries with one value the parent does not */
  shared: Record<string, unknown>
  /**
   * whether the table names each member: their names differ, or a member holds
   * subfeatures, whose summary sits under its name. One name on every member
   * is shared instead.
   */
  named: boolean
}

// what a member's row already says: its number, position and length, and the
// group's type
const shownByRow = new Set([
  'refName',
  'start',
  'end',
  'strand',
  'type',
  'uniqueId',
  'subfeatures',
])

const typeOf = (feature: { type?: string }) => feature.type ?? 'subfeature'

function same(a: unknown, b: unknown) {
  return a === b || JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Whether a subfeature's attribute only restates what is already on screen:
 * its parent's value under the same key (a `source`, a gene_id copied onto
 * every exon), a pointer back to the parent (`Parent=EDEN.1`), or its own type
 * (NCBI's `gbkey=CDS` on a CDS).
 */
export function restates(
  key: string,
  value: unknown,
  parent: SimpleFeatureSerialized,
  type: string,
) {
  return (
    same(value, parent[key]) ||
    (typeof value === 'string' &&
      (value === parent.id ||
        value === parent.name ||
        value.toLowerCase() === type.toLowerCase()))
  )
}

function sharedAttributes(
  members: SubfeatureMember[],
  parent: SimpleFeatureSerialized,
  type: string,
) {
  const [first, ...rest] = members.map(m => m.feature)
  return Object.fromEntries(
    Object.entries(first ?? {}).filter(
      ([key, value]) =>
        !shownByRow.has(key) &&
        value != null &&
        !restates(key, value, parent, type) &&
        rest.every(other => same(other[key], value)),
    ),
  )
}

/** What names a member in its row: its name, else its id. */
export function memberLabel(feature: SimpleFeatureSerialized) {
  const label = feature.name ?? feature.id
  return label == null ? undefined : String(label)
}

/**
 * A feature's subfeatures by type, in the order the types first appear: a
 * gene's transcripts, or a transcript's exons and its CDS. Every level groups
 * the same way, so a CDS with mature peptides of its own sits in the CDS group
 * beside the CDS without.
 */
export function subfeatureGroups(
  feature: SimpleFeatureSerialized,
  unformatted?: SimpleFeatureSerialized,
): SubfeatureGroup[] {
  const members = (feature.subfeatures ?? []).map((sub, idx) => {
    const uniqueId = `${feature.uniqueId}_${idx}`
    const raw = unformatted?.subfeatures?.[idx]
    return {
      feature: { ...sub, uniqueId },
      unformatted: raw ? { ...raw, uniqueId } : undefined,
    }
  })
  const forward = (a: SubfeatureMember, b: SubfeatureMember) =>
    feature.strand === -1
      ? b.feature.start - a.feature.start
      : a.feature.start - b.feature.start
  return [...Map.groupBy(members, m => typeOf(m.feature))].map(
    ([type, group]) => {
      const sorted = group.toSorted(forward)
      const labels = new Set(sorted.map(m => memberLabel(m.feature)))
      const named =
        sorted.some(m => !!m.feature.subfeatures?.length) || labels.size > 1
      const { name, ...rest } = sharedAttributes(sorted, feature, type)
      return {
        type,
        members: sorted,
        shared: named || name === undefined ? rest : { name, ...rest },
        named,
      }
    },
  )
}

/** The attribute keys a member's own expansion leaves out. */
export function omittedForMember(
  member: SimpleFeatureSerialized,
  group: SubfeatureGroup,
  parent: SimpleFeatureSerialized,
) {
  return [
    ...shownByRow,
    'name',
    ...Object.keys(group.shared),
    ...Object.entries(member)
      .filter(
        ([key, value]) =>
          restates(key, value, parent, group.type) ||
          value === memberLabel(member),
      )
      .map(([key]) => key),
  ]
}

/** Total coding bases under a feature, a duplicated CDS row counted once. */
export function cdsLength(feature: SimpleFeatureSerialized) {
  return codingLength(serializedIsoformReader, feature)
}

function counted(type: string, count: number) {
  return `${toLocale(count)} ${type}${count === 1 ? '' : 's'}`
}

/**
 * What a feature holds, by plain counting: the count of its most numerous
 * type of subfeature, and its coding bases when it has CDS — `11 exons · CDS
 * 1,182 bp`, `12 match_parts`. Its UTRs, start and stop codons are one click
 * away, and nothing is inferred: a source annotating only CDS and UTRs reports
 * no exons.
 */
export function subfeatureSummary(feature: SimpleFeatureSerialized) {
  const byType = [...Map.groupBy(feature.subfeatures ?? [], typeOf)]
  const cds = byType.find(([type]) => type.toLowerCase() === 'cds')
  const [most] = byType
    .filter(entry => entry !== cds)
    .toSorted((a, b) => b[1].length - a[1].length)
  return [
    most ? counted(most[0], most[1].length) : undefined,
    cds ? `${cds[0]} ${toLocale(cdsLength(feature))} bp` : undefined,
  ]
    .filter(part => part !== undefined)
    .join(' · ')
}
