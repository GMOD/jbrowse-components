import type {
  SimpleFeatureSerialized,
  SimpleFeatureSerializedNoId,
} from '../../util/index.ts'

export type SubfeatureGroup =
  | { kind: 'feature'; feature: SimpleFeatureSerialized }
  | {
      kind: 'parts'
      type: string
      /** in transcription order: 5′ to 3′ on the parent's strand */
      parts: SimpleFeatureSerialized[]
      /** attributes every part carries with one value */
      shared: Record<string, unknown>
      /** attributes whose value differs between parts, one column each */
      varying: string[]
    }

const positional = new Set([
  'refName',
  'start',
  'end',
  'strand',
  'type',
  'uniqueId',
  'subfeatures',
])

function hasChildren(sub: SimpleFeatureSerializedNoId) {
  return !!sub.subfeatures?.length
}

function partsGroup(
  type: string,
  members: SimpleFeatureSerialized[],
  strand: number | undefined,
): SubfeatureGroup {
  const parts = members.toSorted((a, b) =>
    strand === -1 ? b.start - a.start : a.start - b.start,
  )
  const keys = [
    ...new Set(
      parts.flatMap(part =>
        Object.keys(part).filter(
          key => !positional.has(key) && part[key] != null,
        ),
      ),
    ),
  ]
  const isShared = (key: string) => {
    const first = JSON.stringify(parts[0]![key])
    return parts.every(
      part => part[key] != null && JSON.stringify(part[key]) === first,
    )
  }
  return {
    kind: 'parts',
    type,
    parts,
    shared: Object.fromEntries(
      keys.filter(isShared).map(key => [key, parts[0]![key]]),
    ),
    varying: keys.filter(key => !isShared(key)),
  }
}

/**
 * A feature's subfeatures as the details panel lists them. A subfeature with
 * children of its own, a transcript in a gene, is a feature to read on its
 * own. One without, an exon or a CDS, is a part: parts of one type are one
 * group, placed where the first of them sits.
 */
export function subfeatureGroups(
  feature: SimpleFeatureSerialized,
): SubfeatureGroup[] {
  const subs = (feature.subfeatures ?? []).map((sub, idx) => ({
    ...sub,
    uniqueId: `${feature.uniqueId}_${idx}`,
  }))
  const typeOf = (sub: SimpleFeatureSerialized) => sub.type ?? 'subfeature'
  const partsByType = Map.groupBy(
    subs.filter(sub => !hasChildren(sub)),
    typeOf,
  )
  return subs.flatMap(sub => {
    const members = partsByType.get(typeOf(sub))
    return hasChildren(sub)
      ? [{ kind: 'feature' as const, feature: sub }]
      : members?.[0] === sub
        ? [partsGroup(typeOf(sub), members, feature.strand)]
        : []
  })
}
