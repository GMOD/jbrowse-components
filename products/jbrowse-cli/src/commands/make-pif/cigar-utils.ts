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

// Convert a minimap2 `cs` difference string (https://github.com/lh3/minimap2#cs)
// to a standard CIGAR. Short form (`:N` match, `*ab` substitution, `+seq`
// insertion, `-seq` deletion), long form (`=SEQ` match), and `~` splice/introns
// are handled: matches -> `=`, substitutions -> `X`, insertions -> `I`,
// deletions -> `D`, introns -> `N`. Sequence bases are dropped so the result
// reorients with the same flipCigar/swapIndelCigar helpers as `cg`.
export function csToCigar(cs: string): string {
  const ops: [number, string][] = []
  function push(len: number, op: string) {
    if (len > 0) {
      const last = ops[ops.length - 1]
      if (last?.[1] === op) {
        last[0] += len
      } else {
        ops.push([len, op])
      }
    }
  }
  function countBases(start: number) {
    let j = start
    while (j < cs.length && /[A-Za-z]/.test(cs[j]!)) {
      j++
    }
    return j - start
  }
  function countDigits(start: number) {
    let j = start
    let len = 0
    while (j < cs.length && cs.charCodeAt(j) >= 48 && cs.charCodeAt(j) <= 57) {
      len = len * 10 + (cs.charCodeAt(j) - 48)
      j++
    }
    return { len, next: j }
  }

  let i = 0
  while (i < cs.length) {
    const c = cs[i]!
    if (c === ':') {
      const { len, next } = countDigits(i + 1)
      push(len, '=')
      i = next
    } else if (c === '=') {
      const n = countBases(i + 1)
      push(n, '=')
      i = i + 1 + n
    } else if (c === '*') {
      push(1, 'X')
      i += 3
    } else if (c === '+') {
      const n = countBases(i + 1)
      push(n, 'I')
      i = i + 1 + n
    } else if (c === '-') {
      const n = countBases(i + 1)
      push(n, 'D')
      i = i + 1 + n
    } else if (c === '~') {
      const { len, next } = countDigits(i + 3)
      push(len, 'N')
      i = next + 2
    } else {
      i++
    }
  }
  let result = ''
  for (const [len, op] of ops) {
    result += len
    result += op
  }
  return result
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
