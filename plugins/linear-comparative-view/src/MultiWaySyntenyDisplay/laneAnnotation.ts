// How well an adapter type answers "this lane's gene models", best first. A
// lane takes the best-ranked single-assembly track the session holds for it;
// a type absent here is not annotation this display can draw from at all —
// alignments, coverage, variants, sequence.
//
// RANKED, not a set, and that is the whole design. GFF3-only was too narrow: a
// lane annotated by a GTF or a BigBed read as `· no annotation`, which is the
// header asserting something false about a track sitting in the same session,
// with no error to debug from. But widening to "anything with features" picks
// by declaration order, and the config shape this display meets pairs a GFF3
// gene track with a BED RepeatMasker track on one assembly — so a flat set
// would newly prefer the repeats. Ranking keeps the old answer wherever the
// old answer existed.
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
