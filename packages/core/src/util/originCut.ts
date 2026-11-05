const TAIL_SUFFIX = '-origin'

/**
 * The id of the piece of a feature lying past a circular sequence's origin,
 * the feature cut there and `id` the piece before it. Only GFF3 cuts:
 * bedToBigBed refuses an end past the contig, and on 2026-10-11 none of hg38's
 * 35 hosted BED tabix tracks had a chrM record ending past 16569.
 *
 * The linear view reads across the origin with the tail and head typed as two
 * regions, `NC_012920.1:15,000-16,569 NC_012920.1:1-2,000`, where the two
 * pieces abut in one row. A locstring that wraps past the origin, or a menu
 * item, would save the typing; neither was built (2026-10-14).
 */
export function originTailId(id: string) {
  return `${id}${TAIL_SUFFIX}`
}

/** The id of the piece before the origin, when `id` names the one past it. */
export function originHeadId(id: string) {
  return id.endsWith(TAIL_SUFFIX) ? id.slice(0, -TAIL_SUFFIX.length) : undefined
}

/**
 * The id the uncut feature gives the subfeature a piece calls `subfeatureId`,
 * `pieceId` the piece's own id: the piece before the origin already carries
 * the feature's id, and the one past it its `originTailId`.
 */
export function wholeSubfeatureId(pieceId: string, subfeatureId: string) {
  const head = originHeadId(pieceId)
  return head !== undefined && subfeatureId.startsWith(`${pieceId}-`)
    ? `${head}${subfeatureId.slice(pieceId.length)}`
    : subfeatureId
}
