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
}

// what a member's row already says: its number, name, position and length,
// and the group's type
const shownByRow = new Set([
  'refName',
  'start',
  'end',
  'strand',
  'type',
  'name',
  'uniqueId',
  'subfeatures',
])

const typeOf = (feature: { type?: string }) => feature.type ?? 'subfeature'

function same(a: unknown, b: unknown) {
  return a === b || JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Whether a subfeature's attribute only repeats its parent: the same value
 * under the same key (a `source`, a gene_id copied onto every exon), or a
 * pointer back to the parent (`Parent=EDEN.1`).
 */
export function repeatsParent(
  key: string,
  value: unknown,
  parent: SimpleFeatureSerialized,
) {
  return (
    same(value, parent[key]) ||
    (typeof value === 'string' &&
      (value === parent.id || value === parent.name))
  )
}

function sharedAttributes(
  members: SubfeatureMember[],
  parent: SimpleFeatureSerialized,
) {
  const [first, ...rest] = members.map(m => m.feature)
  return Object.fromEntries(
    Object.entries(first ?? {}).filter(
      ([key, value]) =>
        !shownByRow.has(key) &&
        value != null &&
        !repeatsParent(key, value, parent) &&
        rest.every(other => same(other[key], value)),
    ),
  )
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
      return {
        type,
        members: sorted,
        shared: sharedAttributes(sorted, feature),
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
    ...Object.keys(group.shared),
    ...Object.entries(member)
      .filter(([key, value]) => repeatsParent(key, value, parent))
      .map(([key]) => key),
  ]
}

/** Total coding bases under a feature, a duplicated CDS row counted once. */
export function cdsLength(feature: SimpleFeatureSerialized) {
  return codingLength(serializedIsoformReader, feature)
}

/**
 * What a feature holds, by plain counting: `CDS 2,313 bp` for its coding
 * parts and `4 exon` for any other type. Nothing is inferred, so a source
 * annotating only CDS and UTRs reports no exons.
 */
export function subfeatureSummary(feature: SimpleFeatureSerialized) {
  return [...Map.groupBy(feature.subfeatures ?? [], typeOf)]
    .map(([type, subs]) =>
      type.toLowerCase() === 'cds'
        ? `${type} ${toLocale(cdsLength(feature))} bp`
        : `${subs.length} ${type}`,
    )
    .join(' · ')
}
