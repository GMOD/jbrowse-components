// Ranked, not a set: a flat set would pick a BED repeat track over GFF3 genes.
const ANNOTATION_ADAPTER_RANK = [
  ['Gff3Adapter', 'Gff3TabixAdapter'],
  ['GtfAdapter', 'GtfTabixAdapter'],
  ['BigBedAdapter', 'BedTabixAdapter', 'BedAdapter'],
  ['NCListAdapter', 'FromConfigAdapter', 'SPARQLAdapter'],
]

/** lower is better; `undefined` for a type that is not gene annotation */
export function annotationRank(type: string | undefined) {
  if (type === undefined) {
    return undefined
  }
  const rank = ANNOTATION_ADAPTER_RANK.findIndex(tier => tier.includes(type))
  return rank < 0 ? undefined : rank
}
