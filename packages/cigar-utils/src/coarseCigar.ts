import {
  CIGAR_D,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_RUN,
} from './cigarConstants.ts'

export interface CoarsenedCigar {
  ops: string
  ownLen: number
  mateLen: number
  gapCount: number
}

/**
 * #api
 * Fold a CIGAR into a coarse CIGAR. Every indel shorter than `minGap` is
 * absorbed into the match run around it, and a run whose two axes advanced by
 * different amounts is written `<own>:<mate>M`; a square run stays `<n>M`.
 * D/N/I at least `minGap` long keep their letter and length. `=`/`X` count as
 * M. `ownLen`/`mateLen` are the totals each axis consumed, for the caller to
 * check against the row's coordinate columns.
 *
 * A run is also closed before a folded indel would push its running skew
 * (own minus mate) past `minGap / 2`, so the straight line between a run's
 * corners is never more than `minGap` off the alignment's own path inside it.
 * That is what lets a reader interpolate within a run, and it costs a new run
 * only where the two genomes' small indels are lopsided.
 */
export function coarsenCigar(cigar: string, minGap: number): CoarsenedCigar {
  const skewBound = minGap / 2
  let ops = ''
  let ownLen = 0
  let mateLen = 0
  let gapCount = 0
  let runOwn = 0
  let runMate = 0
  const flushRun = () => {
    if (runOwn > 0 || runMate > 0) {
      ops += runOwn === runMate ? `${runOwn}M` : `${runOwn}:${runMate}M`
      runOwn = 0
      runMate = 0
    }
  }
  const fold = (own: number, mate: number) => {
    if (Math.abs(runOwn + own - runMate - mate) > skewBound) {
      flushRun()
    }
    runOwn += own
    runMate += mate
  }
  let len = 0
  for (let i = 0, l = cigar.length; i < l; i++) {
    const code = cigar.charCodeAt(i)
    if (code >= 48 && code <= 57) {
      len = len * 10 + code - 48
    } else {
      const op = cigar[i]!
      if (op === 'M' || op === '=' || op === 'X') {
        runOwn += len
        runMate += len
        ownLen += len
        mateLen += len
      } else if (op === 'D' || op === 'N') {
        ownLen += len
        if (len >= minGap) {
          flushRun()
          ops += `${len}${op}`
          gapCount++
        } else {
          fold(len, 0)
        }
      } else if (op === 'I') {
        mateLen += len
        if (len >= minGap) {
          flushRun()
          ops += `${len}I`
          gapCount++
        } else {
          fold(0, len)
        }
      }
      len = 0
    }
  }
  flushRun()
  return { ops, ownLen, mateLen, gapCount }
}

interface CoarseOp {
  own: number
  mate: number
  op: string
}

function parseCoarseOps(s: string) {
  const out: CoarseOp[] = []
  let len = 0
  let ownBeforeColon: number | undefined
  for (let i = 0, l = s.length; i < l; i++) {
    const code = s.charCodeAt(i)
    if (code >= 48 && code <= 57) {
      len = len * 10 + code - 48
    } else if (code === 58) {
      ownBeforeColon = len
      len = 0
    } else {
      const op = s[i]!
      if (op === 'M') {
        out.push({
          own: ownBeforeColon === undefined ? len : ownBeforeColon,
          mate: len,
          op,
        })
      } else if (op === 'I') {
        out.push({ own: 0, mate: len, op })
      } else {
        out.push({ own: len, mate: 0, op })
      }
      ownBeforeColon = undefined
      len = 0
    }
  }
  return out
}

function serializeCoarseOps(ops: CoarseOp[]) {
  let s = ''
  for (const { own, mate, op } of ops) {
    s +=
      op === 'M'
        ? own === mate
          ? `${own}M`
          : `${own}:${mate}M`
        : `${op === 'I' ? mate : own}${op}`
  }
  return s
}

// N keeps its axis as well as its letter, matching `swapIndelCigar`, which
// swaps only D<->I
function swapAxes({ own, mate, op }: CoarseOp): CoarseOp {
  return op === 'N'
    ? { own, mate, op }
    : {
        own: mate,
        mate: own,
        op: op === 'D' ? 'I' : op === 'I' ? 'D' : op,
      }
}

/**
 * #api
 * The coarse CIGAR seen from the other axis on the plus strand: the two lengths
 * of every run trade places and D<->I swap, op order untouched. The twin of
 * `swapIndelCigar`.
 */
export function swapCoarseCigar(s: string) {
  return serializeCoarseOps(parseCoarseOps(s).map(swapAxes))
}

/**
 * #api
 * The coarse CIGAR seen from the other axis on the minus strand: swapped as
 * `swapCoarseCigar` does, and in reverse op order. The twin of `flipCigar`.
 */
export function flipCoarseCigar(s: string) {
  return serializeCoarseOps(parseCoarseOps(s).map(swapAxes).reverse())
}

// The packed form keeps 28 bits of length, so a longer op is written as several
// words that sum to it. A run is split with both axes in proportion.
const MAX_PACKED_LEN = 2 ** 28 - 1

function pushPacked(out: number[], len: number, code: number) {
  for (let rest = len; rest > 0; rest -= MAX_PACKED_LEN) {
    out.push(((Math.min(rest, MAX_PACKED_LEN) << 4) | code) >>> 0)
  }
}

function pushRun(out: number[], own: number, mate: number) {
  if (own === mate) {
    pushPacked(out, own, CIGAR_M)
  } else {
    const chunks = Math.ceil(Math.max(own, mate) / MAX_PACKED_LEN)
    for (let i = 0; i < chunks; i++) {
      const o =
        Math.floor((own * (i + 1)) / chunks) - Math.floor((own * i) / chunks)
      const m =
        Math.floor((mate * (i + 1)) / chunks) - Math.floor((mate * i) / chunks)
      out.push(((o << 4) | CIGAR_RUN) >>> 0, ((m << 4) | CIGAR_RUN) >>> 0)
    }
  }
}

/**
 * #api
 * Parse a coarse CIGAR into the packed `(len << 4) | op` form
 * `visitCigarRenderedSegments` walks. A square run packs as one `CIGAR_M`
 * word; an unequal run as a `CIGAR_RUN` word pair, own axis first.
 */
export function parseCoarseCigar(s: string) {
  const out: number[] = []
  for (const { own, mate, op } of parseCoarseOps(s)) {
    if (op === 'M') {
      pushRun(out, own, mate)
    } else if (op === 'I') {
      pushPacked(out, mate, CIGAR_I)
    } else {
      pushPacked(out, own, op === 'N' ? CIGAR_N : CIGAR_D)
    }
  }
  return Uint32Array.from(out)
}
