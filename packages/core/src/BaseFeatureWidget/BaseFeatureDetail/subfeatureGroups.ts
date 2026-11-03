import type {
  SimpleFeatureSerialized,
  SimpleFeatureSerializedNoId,
} from '../../util/index.ts'

export interface SubfeatureCard {
  feature: SimpleFeatureSerialized
  /** the same subfeature before any `formatDetails` callback ran */
  unformatted?: SimpleFeatureSerialized
}

export interface Part {
  feature: SimpleFeatureSerialized
  /** what this part carries that neither its group nor its parent says */
  own: Record<string, unknown>
}

export interface PartsGroup {
  type: string
  /** in transcription order: 5′ to 3′ on the parent's strand */
  parts: Part[]
  /** attributes every part carries with one value */
  shared: Record<string, unknown>
  phased: boolean
}

export interface Subfeatures {
  /** subfeatures with children of their own, a gene's transcripts */
  cards: SubfeatureCard[]
  /** the leaf subfeatures, one group per type */
  groups: PartsGroup[]
}

// what a part's row already says, or the nesting does: GFF3's `ID` and
// `Parent` link a part to the transcript it sits in. Lowercase, matched
// against a lowercased key
const shownByRow = new Set([
  'refname',
  'start',
  'end',
  'strand',
  'type',
  'uniqueid',
  'subfeatures',
  'phase',
  'id',
  'parent',
])

function hasChildren(sub: SimpleFeatureSerializedNoId) {
  return !!sub.subfeatures?.length
}

function sameValue(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function partsGroup(
  type: string,
  members: SimpleFeatureSerialized[],
  parent: SimpleFeatureSerialized,
): PartsGroup {
  const sorted = members.toSorted((a, b) =>
    parent.strand === -1 ? b.end - a.end : a.start - b.start,
  )
  const ownKeys = (part: SimpleFeatureSerialized) =>
    Object.keys(part).filter(
      key =>
        !shownByRow.has(key.toLowerCase()) &&
        part[key] != null &&
        !sameValue(part[key], parent[key]),
    )
  const [first] = sorted
  const keys = [...new Set(sorted.flatMap(ownKeys))]
  const isShared = (key: string) =>
    sorted.every(
      part => part[key] != null && sameValue(part[key], first?.[key]),
    )
  const sharedKeys = new Set(keys.filter(isShared))
  return {
    type,
    parts: sorted.map(feature => ({
      feature,
      own: Object.fromEntries(
        ownKeys(feature)
          .filter(key => !sharedKeys.has(key))
          .map(key => [key, feature[key]]),
      ),
    })),
    shared: Object.fromEntries([...sharedKeys].map(key => [key, first?.[key]])),
    phased: sorted.some(part => part.phase != null),
  }
}

// a group sits where its 5′-most part does, the larger first on a tie, so a
// transcript reads exons, the 5′ UTR, CDS, start and stop codons, 3′ UTR
function byTranscriptionOrder(strand: number | undefined) {
  const fivePrime = (group: PartsGroup) => {
    const [first] = group.parts
    return first === undefined
      ? 0
      : strand === -1
        ? -first.feature.end
        : first.feature.start
  }
  return (a: PartsGroup, b: PartsGroup) =>
    fivePrime(a) - fivePrime(b) || b.parts.length - a.parts.length
}

/**
 * A feature's subfeatures as the details panel lists them. A subfeature with
 * children of its own, a transcript in a gene, is a card to read on its own.
 * One without, an exon or a CDS, is a part: parts of one type are one group,
 * and a part states only what neither its group nor its parent already says.
 */
export function subfeatureGroups(
  feature: SimpleFeatureSerialized,
  unformatted?: SimpleFeatureSerialized,
): Subfeatures {
  const subs = (feature.subfeatures ?? []).map((sub, idx) => ({
    ...sub,
    uniqueId: `${feature.uniqueId}_${idx}`,
  }))
  const cards = subs.flatMap((sub, idx) => {
    const raw = unformatted?.subfeatures?.[idx]
    return hasChildren(sub)
      ? [
          {
            feature: sub,
            unformatted: raw ? { ...raw, uniqueId: sub.uniqueId } : undefined,
          },
        ]
      : []
  })
  const leaves = Map.groupBy(
    subs.filter(sub => !hasChildren(sub)),
    sub => sub.type ?? 'subfeature',
  )
  return {
    cards,
    groups: [...leaves]
      .map(([type, members]) => partsGroup(type, members, feature))
      .toSorted(byTranscriptionOrder(feature.strand)),
  }
}
