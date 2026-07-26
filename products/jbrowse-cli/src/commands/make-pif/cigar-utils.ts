export interface CigarSegment {
  tstart: number
  tend: number
  qstart: number
  qend: number
  // Aligned length of this piece: M/=/X plus the small indels kept inside it,
  // excluding the large gaps split on. Only ever used as the weight that
  // apportions the row's PAF num_matches/block_len across its pieces (see
  // pif-generator) — residue matches are deliberately NOT counted here, because
  // an M-style CIGAR folds mismatches into M and a count off it would claim
  // ~100% identity for a divergent alignment.
  blockLen: number
}

// Walk a CIGAR and split the alignment wherever an insertion or deletion is at
// least `splitGap` bp, so each coarse-tier row's bounding box stays tight.
// Returns one segment per contiguous run; `splitGap` must be positive (the
// caller keeps the whole row when there is nothing to split on).
// PAF semantics: qstart < qend always; '-' strand CIGAR walks query backward.
// The target end is derived from the walk, so it isn't taken as an input.
export function splitCigarOnLargeGaps({
  cigar,
  strand,
  tstart,
  qstart,
  qend,
  splitGap,
}: {
  cigar: string
  strand: string
  tstart: number
  qstart: number
  qend: number
  splitGap: number
}): CigarSegment[] {
  const qStep = strand === '-' ? -1 : 1
  let tCursor = tstart
  let qCursor = strand === '-' ? qend : qstart
  let segTStart = tCursor
  let segQAnchor = qCursor
  let segBlockLen = 0
  const out: CigarSegment[] = []

  const emit = () => {
    if (tCursor > segTStart || qCursor !== segQAnchor) {
      out.push({
        tstart: segTStart,
        tend: tCursor,
        qstart: Math.min(segQAnchor, qCursor),
        qend: Math.max(segQAnchor, qCursor),
        blockLen: segBlockLen,
      })
    }
  }

  // Parse CIGAR directly to avoid intermediate array + string-to-number conversions
  let i = 0
  while (i < cigar.length) {
    let len = 0
    while (
      i < cigar.length &&
      cigar.charCodeAt(i) >= 48 &&
      cigar.charCodeAt(i) <= 57
    ) {
      len = len * 10 + cigar.charCodeAt(i++) - 48
    }
    const op = cigar[i++]!
    if ('M=X'.includes(op)) {
      tCursor += len
      qCursor += len * qStep
      segBlockLen += len
    } else if ('DIN'.includes(op)) {
      const isLarge = len >= splitGap
      if (isLarge) {
        emit()
      }
      if (op === 'I') {
        qCursor += len * qStep
      } else {
        tCursor += len
      }
      if (isLarge) {
        segTStart = tCursor
        segQAnchor = qCursor
        segBlockLen = 0
      } else {
        segBlockLen += len
      }
    }
    // S/H/P (clipping/padding) don't consume target or forward-strand query in PAF
  }
  emit()
  return out
}
