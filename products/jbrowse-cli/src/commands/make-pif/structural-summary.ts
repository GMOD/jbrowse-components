import { parseCigar } from './cigar-utils.ts'

export interface AlignmentRecord {
  qname: string
  qlen: string
  qstart: number
  qend: number
  strand: string
  tname: string
  tlen: string
  tstart: number
  tend: number
  cigar: string | undefined
}

export interface CoarseRecord {
  qname: string
  qlen: string
  qstart: number
  qend: number
  strand: string
  tname: string
  tlen: string
  tstart: number
  tend: number
  numMatches: number
  blockLen: number
}

// Walk a CIGAR and split the alignment whenever an insertion or deletion is
// at least `splitGap` bp. Returns one CoarseRecord per contiguous run between
// such gaps. When `splitGap <= 0` (or the alignment has no qualifying gap),
// returns a single record covering the whole row. Each returned record has
// accurate qstart/qend/tstart/tend for its slice plus the CIGAR-derived
// numMatches / blockLen (so identity = numMatches / blockLen stays correct).
//
// Coords assume PAF semantics: qstart < qend on the forward strand of the
// query for both '+' and '-' strands. For '-' strand the CIGAR walks query
// from qend down to qstart as target advances from tstart to tend.
export function splitCigarOnLargeGaps(
  rec: AlignmentRecord,
  splitGap: number | undefined,
): CoarseRecord[] {
  const baseFields = {
    qname: rec.qname,
    qlen: rec.qlen,
    strand: rec.strand,
    tname: rec.tname,
    tlen: rec.tlen,
  }
  if (!rec.cigar) {
    return [
      {
        ...baseFields,
        qstart: rec.qstart,
        qend: rec.qend,
        tstart: rec.tstart,
        tend: rec.tend,
        numMatches: 0,
        blockLen: rec.tend - rec.tstart,
      },
    ]
  }

  const ops = parseCigar(rec.cigar)
  const qStep = rec.strand === '-' ? -1 : 1
  let tCursor = rec.tstart
  let qCursor = rec.strand === '-' ? rec.qend : rec.qstart
  let segTStart = tCursor
  let segQAnchor = qCursor
  let segMatches = 0
  let segBlockLen = 0
  const out: CoarseRecord[] = []

  const flushSegment = () => {
    const tEnd = tCursor
    const qOther = qCursor
    if (tEnd > segTStart || qOther !== segQAnchor) {
      out.push({
        ...baseFields,
        tstart: segTStart,
        tend: tEnd,
        qstart: Math.min(segQAnchor, qOther),
        qend: Math.max(segQAnchor, qOther),
        numMatches: segMatches,
        blockLen: segBlockLen,
      })
    }
    segTStart = tCursor
    segQAnchor = qCursor
    segMatches = 0
    segBlockLen = 0
  }

  const canSplit =
    splitGap !== undefined && Number.isFinite(splitGap) && splitGap > 0
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
    } else if (op === 'D' || op === 'N') {
      if (canSplit && len >= splitGap) {
        flushSegment()
        tCursor += len
        segTStart = tCursor
        segQAnchor = qCursor
      } else {
        tCursor += len
        segBlockLen += len
      }
    } else if (op === 'I') {
      if (canSplit && len >= splitGap) {
        flushSegment()
        qCursor += len * qStep
        segQAnchor = qCursor
        segTStart = tCursor
      } else {
        qCursor += len * qStep
        segBlockLen += len
      }
    }
    // S, H, P are clipping / padding ops — they don't consume target or
    // forward-strand query coords in PAF and never appear as split points.
  }
  flushSegment()
  return out
}
