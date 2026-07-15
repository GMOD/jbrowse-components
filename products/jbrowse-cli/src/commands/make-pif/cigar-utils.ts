export interface CigarSegment {
  tstart: number
  tend: number
  qstart: number
  qend: number
  numMatches: number
  blockLen: number
  // Gap-compressed sequence divergence (minimap2 `de:f:` semantics): each indel
  // run counts once as a gap event, not once per base. Counting indel bases
  // (as `1 - numMatches/blockLen` would) roughly doubles the reported
  // divergence, so this keeps a split row's coarse pieces coloring like the
  // aligner's own per-row tag. A plain `cg` CIGAR folds substitutions into `M`,
  // so `mismatches` is only nonzero for an `=`/`X` CIGAR; the caller prefers the
  // row's own `de:f:` tag over this value whenever the row carries one.
  divergence: number
}

function gapCompressedDivergence(
  matches: number,
  mismatches: number,
  gapEvents: number,
) {
  const denom = matches + mismatches + gapEvents
  return denom > 0 ? (mismatches + gapEvents) / denom : 0
}

// Walk a CIGAR and split the alignment whenever an insertion or deletion
// is at least `splitGap` bp. Returns one segment per contiguous run. When
// splitGap is 0 or undefined, returns a single segment with full stats.
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
  splitGap: number | undefined
}): CigarSegment[] {
  const qStep = strand === '-' ? -1 : 1
  let tCursor = tstart
  let qCursor = strand === '-' ? qend : qstart
  let segTStart = tCursor
  let segQAnchor = qCursor
  let segMatches = 0
  let segMismatches = 0
  let segGapEvents = 0
  let segBlockLen = 0
  const out: CigarSegment[] = []

  const emit = () => {
    if (tCursor > segTStart || qCursor !== segQAnchor) {
      out.push({
        tstart: segTStart,
        tend: tCursor,
        qstart: Math.min(segQAnchor, qCursor),
        qend: Math.max(segQAnchor, qCursor),
        numMatches: segMatches,
        blockLen: segBlockLen,
        divergence: gapCompressedDivergence(
          segMatches,
          segMismatches,
          segGapEvents,
        ),
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
      if (op === 'X') {
        segMismatches += len
      } else {
        segMatches += len
      }
    } else if ('DIN'.includes(op)) {
      const isLarge = splitGap !== undefined && splitGap > 0 && len >= splitGap
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
        segMatches = 0
        segMismatches = 0
        segGapEvents = 0
        segBlockLen = 0
      } else {
        segBlockLen += len
        segGapEvents += 1
      }
    }
    // S/H/P (clipping/padding) don't consume target or forward-strand query in PAF
  }
  emit()
  return out
}
