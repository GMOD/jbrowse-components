// Two-pass: collect token start indices, then walk backward slicing the digit
// run directly from the original string — avoids intermediate number/op arrays.
export function flipCigar(cigar: string): string {
  const starts: number[] = []
  let i = 0
  while (i < cigar.length) {
    starts.push(i)
    while (cigar.charCodeAt(i) >= 48 && cigar.charCodeAt(i) <= 57) {
      i++
    }
    i++ // skip op char
  }
  let result = ''
  for (let j = starts.length - 1; j >= 0; j--) {
    const s = starts[j]!
    const end = j + 1 < starts.length ? starts[j + 1]! : cigar.length
    const op = cigar[end - 1]!
    result +=
      cigar.slice(s, end - 1) + (op === 'D' ? 'I' : op === 'I' ? 'D' : op)
  }
  return result
}

export function swapIndelCigar(cigar: string): string {
  return cigar.replaceAll(/[DI]/g, op => (op === 'D' ? 'I' : 'D'))
}

export interface CigarSegment {
  tstart: number
  tend: number
  qstart: number
  qend: number
  numMatches: number
  blockLen: number
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
      if (op !== 'X') {
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
