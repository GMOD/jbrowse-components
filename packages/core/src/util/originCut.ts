const TAIL_SUFFIX = '-origin'

/**
 * The id of the piece of a feature lying past a circular sequence's origin,
 * the feature cut there and `id` the piece before it. Only GFF3 cuts:
 * bedToBigBed refuses an end past the contig, and on 2026-10-11 none of hg38's
 * 35 hosted BED tabix tracks had a chrM record ending past 16569.
 */
export function originTailId(id: string) {
  return `${id}${TAIL_SUFFIX}`
}

/** The id of the piece before the origin, when `id` names the one past it. */
export function originHeadId(id: string) {
  return id.endsWith(TAIL_SUFFIX) ? id.slice(0, -TAIL_SUFFIX.length) : undefined
}
