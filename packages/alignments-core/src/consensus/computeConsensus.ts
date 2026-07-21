import {
  DELETION_TYPE,
  INSERTION_TYPE,
  MISMATCH_TYPE,
  SKIP_TYPE,
} from '@jbrowse/cigar-utils'

import type { MismatchCallback } from '@jbrowse/cigar-utils'

// Minimal feature shape the tally needs: an aligned ref span plus the shared
// zero-alloc mismatch iterator that BAM and CRAM features both expose.
export interface ConsensusFeature {
  get(field: string): unknown
  forEachMismatch: (
    callback: MismatchCallback,
    windowStart?: number,
    windowEnd?: number,
  ) => void
}

export interface ConsensusRegion {
  start: number
  end: number
}

export interface ConsensusOptions {
  minDepth?: number
  callFract?: number
  includeInsertions?: boolean
  // Character emitted for a called deletion. Default '' omits it, so the output
  // is gapless like `samtools consensus`; set e.g. '-' to keep alignment frame.
  gapChar?: string
}

// samtools' base-weight tables (bam_consensus.c calculate_consensus_simple),
// indexed by BAM 4-bit seqi. A pure base contributes 8 to its own score; an
// ambiguity code splits its weight across component bases (e.g. R -> A+G at 4
// each, N -> all four at 1). This is what makes the call fraction match samtools
// even when reads contain N or IUPAC codes. seqi order matches SEQRET
// ('=ACMGRSVTWYHKDBN').
const SEQI2A = [0, 8, 0, 4, 0, 4, 0, 2, 0, 4, 0, 2, 0, 2, 0, 1]
const SEQI2C = [0, 0, 8, 4, 0, 0, 4, 2, 0, 0, 4, 2, 0, 0, 2, 1]
const SEQI2G = [0, 0, 0, 0, 8, 4, 4, 1, 0, 0, 0, 0, 4, 2, 2, 1]
const SEQI2T = [0, 0, 0, 0, 0, 0, 0, 0, 8, 4, 4, 2, 8, 2, 2, 1]
const GAP_WEIGHT = 8

// char code -> BAM 4-bit seqi, via SEQRET index. Unknown chars map to 0 (no
// vote), so a missing reference base contributes nothing rather than a spurious
// call. Both cases are covered so lowercase soft-masked reference works.
const SEQRET = '=ACMGRSVTWYHKDBN'
const SEQI_FROM_CODE = new Uint8Array(128)
for (let i = 0; i < SEQRET.length; i++) {
  const code = SEQRET.charCodeAt(i)
  SEQI_FROM_CODE[code] = i
  SEQI_FROM_CODE[code | 0x20] = i
}

// Per-position accumulators over [regionStart, regionStart+length). Coverage and
// deletions are difference arrays (O(1) per aligned block / deletion run);
// mismatch scores are dense but only touched where reads diverge from the
// reference. Reference-matching reads are never enumerated — their count is
// recovered as coverage - deletions - mismatchReads at call time and folded in
// at the reference base's weight.
export interface ConsensusTally {
  regionStart: number
  length: number
  covDiff: Int32Array
  delDiff: Int32Array
  scoreA: Int32Array
  scoreC: Int32Array
  scoreG: Int32Array
  scoreT: Int32Array
  mmReads: Int32Array
  insertionAfter: Map<number, string[]>
}

function clamp(p: number, length: number) {
  return p < 0 ? 0 : p > length ? length : p
}

// Default excluded SAM flags mirror `samtools consensus`: UNMAP (0x4),
// SECONDARY (0x100), QCFAIL (0x200), DUP (0x400). SUPPLEMENTARY is intentionally
// kept, as samtools keeps it.
export const DEFAULT_CONSENSUS_EXCLUDE_FLAGS = 0x704

export function buildConsensusTally(
  features: Iterable<ConsensusFeature>,
  region: ConsensusRegion,
  excludeFlags = DEFAULT_CONSENSUS_EXCLUDE_FLAGS,
): ConsensusTally {
  const regionStart = region.start
  const length = region.end - region.start
  const covDiff = new Int32Array(length + 1)
  const delDiff = new Int32Array(length + 1)
  const scoreA = new Int32Array(length)
  const scoreC = new Int32Array(length)
  const scoreG = new Int32Array(length)
  const scoreT = new Int32Array(length)
  const mmReads = new Int32Array(length)
  const insertionAfter = new Map<number, string[]>()

  for (const feature of features) {
    if ((feature.get('flags') as number) & excludeFlags) {
      continue
    }
    const fStart = feature.get('start') as number
    const fEnd = feature.get('end') as number

    const s = clamp(fStart - regionStart, length)
    const e = clamp(fEnd - regionStart, length)
    if (e > s) {
      covDiff[s]!++
      covDiff[e]!--
    }

    feature.forEachMismatch((type, start, len, base) => {
      const gpos = fStart + start
      if (type === MISMATCH_TYPE) {
        const idx = gpos - regionStart
        if (idx >= 0 && idx < length) {
          const seqi = SEQI_FROM_CODE[base.charCodeAt(0) & 0x7f]!
          scoreA[idx]! += SEQI2A[seqi]!
          scoreC[idx]! += SEQI2C[seqi]!
          scoreG[idx]! += SEQI2G[seqi]!
          scoreT[idx]! += SEQI2T[seqi]!
          mmReads[idx]!++
        }
      } else if (type === DELETION_TYPE) {
        const ds = clamp(gpos - regionStart, length)
        const de = clamp(gpos + len - regionStart, length)
        if (de > ds) {
          delDiff[ds]!++
          delDiff[de]!--
        }
      } else if (type === SKIP_TYPE) {
        const ss = clamp(gpos - regionStart, length)
        const se = clamp(gpos + len - regionStart, length)
        if (se > ss) {
          covDiff[ss]!--
          covDiff[se]!++
        }
      } else if (type === INSERTION_TYPE) {
        // Attach to the preceding reference base, matching samtools' (col, nth)
        // ordering where inserted sub-columns follow their anchor base.
        const p = gpos - 1
        if (p >= regionStart && p < region.end) {
          let arr = insertionAfter.get(p)
          if (!arr) {
            arr = []
            insertionAfter.set(p, arr)
          }
          arr.push(base)
        }
      }
    })
  }

  return {
    regionStart,
    length,
    covDiff,
    delDiff,
    scoreA,
    scoreC,
    scoreG,
    scoreT,
    mmReads,
    insertionAfter,
  }
}

const CALL_CHARS = 'ACGT*'

// samtools --mode simple, quality-independent. scores = weighted [A,C,G,T,*];
// totDepth is the read count (for the min-depth gate). The call fraction is
// checked against the weighted total (tscore), exactly as samtools does, so
// ambiguity codes dilute the winner the same way. Returns the winning base, '*'
// for a called gap, or 'N' when too shallow / no base clears the fraction.
function callColumn(
  scores: [number, number, number, number, number],
  totDepth: number,
  minDepth: number,
  callFract: number,
) {
  let call1 = -1
  let score1 = 0
  let tscore = 0
  for (let i = 0; i < 5; i++) {
    const v = scores[i]!
    tscore += v
    if (v > score1) {
      score1 = v
      call1 = i
    }
  }
  if (totDepth < minDepth || score1 < callFract * tscore) {
    return call1 === 4 ? '*' : 'N'
  }
  return call1 === -1 ? 'N' : CALL_CHARS[call1]!
}

// reference is the region's reference sequence, aligned to tally position 0.
export function computeConsensus(
  reference: string,
  tally: ConsensusTally,
  opts: ConsensusOptions = {},
) {
  const minDepth = opts.minDepth ?? 1
  const callFract = opts.callFract ?? 0.75
  const includeInsertions = opts.includeInsertions ?? true
  const gapChar = opts.gapChar ?? ''
  const {
    length,
    regionStart,
    scoreA,
    scoreC,
    scoreG,
    scoreT,
    mmReads,
    covDiff,
    delDiff,
    insertionAfter,
  } = tally

  const out: string[] = []
  let cov = 0
  let del = 0
  for (let i = 0; i < length; i++) {
    cov += covDiff[i]!
    del += delDiff[i]!
    const refMatch = cov - del - mmReads[i]!

    const refCode = i < reference.length ? reference.charCodeAt(i) : 0
    const refSeqi = refCode ? SEQI_FROM_CODE[refCode & 0x7f]! : 0
    const sA = scoreA[i]! + SEQI2A[refSeqi]! * refMatch
    const sC = scoreC[i]! + SEQI2C[refSeqi]! * refMatch
    const sG = scoreG[i]! + SEQI2G[refSeqi]! * refMatch
    const sT = scoreT[i]! + SEQI2T[refSeqi]! * refMatch

    const call = callColumn(
      [sA, sC, sG, sT, del * GAP_WEIGHT],
      cov,
      minDepth,
      callFract,
    )
    if (call === '*') {
      if (gapChar) {
        out.push(gapChar)
      }
    } else {
      out.push(call)
    }

    if (includeInsertions) {
      const ins = insertionAfter.get(regionStart + i)
      if (ins) {
        let maxlen = 0
        for (const seq of ins) {
          if (seq.length > maxlen) {
            maxlen = seq.length
          }
        }
        for (let nth = 1; nth <= maxlen; nth++) {
          let iA = 0
          let iC = 0
          let iG = 0
          let iT = 0
          let present = 0
          for (const seq of ins) {
            if (seq.length >= nth) {
              present++
              const seqi = SEQI_FROM_CODE[seq.charCodeAt(nth - 1) & 0x7f]!
              iA += SEQI2A[seqi]!
              iC += SEQI2C[seqi]!
              iG += SEQI2G[seqi]!
              iT += SEQI2T[seqi]!
            }
          }
          const ichar = callColumn(
            [iA, iC, iG, iT, (cov - present) * GAP_WEIGHT],
            cov,
            minDepth,
            callFract,
          )
          if (ichar !== '*') {
            out.push(ichar)
          }
        }
      }
    }
  }
  return out.join('')
}

export function consensusToFasta(header: string, seq: string, lineLen = 60) {
  const lines = [`>${header}`]
  for (let i = 0; i < seq.length; i += lineLen) {
    lines.push(seq.slice(i, i + lineLen))
  }
  return `${lines.join('\n')}\n`
}
