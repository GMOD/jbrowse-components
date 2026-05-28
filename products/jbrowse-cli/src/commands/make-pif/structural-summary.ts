import { parseCigar } from './cigar-utils.ts'

export interface CigarSegment {
  tstart: number
  tend: number
  qstart: number
  qend: number
  numMatches: number
  blockLen: number
}

// Walk a CIGAR and split the alignment whenever an insertion or deletion is
// at least `splitGap` bp. Returns one segment per contiguous run between
// such gaps. When `splitGap` is unset or 0, or the alignment has no
// qualifying gap, returns a single segment covering the whole row.
//
// Coords assume PAF semantics: qstart < qend on the forward strand of the
// query for both '+' and '-' strands. For '-' strand the CIGAR walks query
// from qend down to qstart as target advances from tstart to tend.
export function splitCigarOnLargeGaps({
  cigar,
  strand,
  tstart,
  tend,
  qstart,
  qend,
  splitGap,
}: {
  cigar: string | undefined
  strand: string
  tstart: number
  tend: number
  qstart: number
  qend: number
  splitGap: number | undefined
}): CigarSegment[] {
  if (!cigar) {
    return [
      {
        tstart,
        tend,
        qstart,
        qend,
        numMatches: 0,
        blockLen: tend - tstart,
      },
    ]
  }

  const ops = parseCigar(cigar)
  const qStep = strand === '-' ? -1 : 1
  const canSplit =
    splitGap !== undefined && Number.isFinite(splitGap) && splitGap > 0
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

  // parseCigar returns ['10', 'M', '4', 'I', ...]
  for (let i = 0; i < ops.length; i += 2) {
    const len = +ops[i]!
    const op = ops[i + 1]!
    if (op === 'M' || op === '=' || op === 'X') {
      tCursor += len
      qCursor += len * qStep
      segBlockLen += len
      if (op !== 'X') {
        segMatches += len
      }
    } else if (op === 'D' || op === 'I' || op === 'N') {
      const isLarge = canSplit && len >= splitGap
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
    // S, H, P are clipping / padding ops — they don't consume target or
    // forward-strand query coords in PAF and never appear as split points.
  }
  emit()
  return out
}
