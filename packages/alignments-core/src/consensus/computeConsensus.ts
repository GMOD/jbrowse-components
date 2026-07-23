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
  // Minimum fraction of the total weighted score the (possibly multi-base)
  // call must explain to be accepted at all; below this it's 'N' (samtools
  // `--call-fract`, default 0.75 matches samtools).
  callFract?: number
  // Minimum ratio of a base's score to the winner's for it to be folded into
  // an IUPAC ambiguity call (samtools `--het-fract`, default 0.5 matches
  // samtools) — a ratio to the winner, not to total depth, so it stays stable
  // across coverage rather than being swamped by noise at high depth.
  // Independent of callFract, and (unlike samtools) not capped at folding in
  // just one runner-up: every base clearing this ratio joins the call, so a
  // real 3-/4-way split (tetraploid, mixed sample) reports as such rather than
  // being truncated to two alleles.
  hetFract?: number
  includeInsertions?: boolean
  // Character emitted for a called deletion. Default '' omits it, so the output
  // is gapless like `samtools consensus`; set e.g. '-' to keep alignment frame.
  gapChar?: string
}

// samtools' base-weight tables (bam_consensus.c calculate_consensus_simple),
// indexed by BAM 4-bit seqi. A pure base contributes 8 to its own score; an
// ambiguity code splits its weight across component bases (e.g. R -> A+G at 4
// each, N -> all four at 1). This is what makes the call fraction match samtools
// even when reads contain N or IUPAC codes. These reproduce samtools's integer
// tables exactly, including its asymmetric V and K weights; all components still
// clear the default 0.5 fold threshold. seqi order matches SEQRET
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

// IUPAC ambiguity code for a set of bases folded into a call, indexed directly
// by the BAM 4-bit base mask (1=A, 2=C, 4=G, 8=T) — e.g. mask 5 (A+G) -> 'R'.
// Index 0 has no IUPAC base and defensively reads as 'N'; index 15 (all four)
// is the standard 'N'.
const IUPAC_FROM_MASK = [
  'N',
  'A',
  'C',
  'M',
  'G',
  'R',
  'S',
  'V',
  'T',
  'W',
  'Y',
  'H',
  'K',
  'D',
  'B',
  'N',
]

// samtools --mode simple, quality-independent, ported from
// calculate_consensus_simple (bam_consensus.c) but uncapped: samtools only
// ever folds in the single runner-up (call2) alongside the winner (call1) —
// fine for human-diploid "het" calls, but it silently drops a real 3rd/4th
// allele in a tetraploid, mixed infection, or pooled sample. Here, *every*
// base whose score is at least hetFract of the winner's gets folded in, so a
// true 3-/4-way split reports as V/H/D/B/N instead of being truncated to two.
// hetFract (samtools default 0.5) is what makes this depth-insensitive: it's
// a ratio to the winner's score, not to total depth, so a fixed per-read error
// rate stays a small ratio at any coverage — 3 error reads out of 1000 is the
// same ~0.3%-of-winner ratio as 1 out of 300, neither remotely close to 0.5.
// callFract (samtools default 0.75) is then the final sanity gate: even after
// folding in everything that clears hetFract, the result must still explain
// most of the column, or it falls back to plain 'N' — this is what samtools'
// own doc comment's "6A, 5G, 4C is N" example demonstrates for its capped
// version; uncapped, that same column instead folds in all three (C also
// clears hetFract relative to A) and reports V rather than giving up to N.
// Gaps take part in the same fold. IUPAC has no base/gap codes, so samtools
// writes a base+gap call as a lowercase base; this implementation extends that
// convention to lowercase IUPAC for an uncapped multi-base+gap call. A gap-only
// call is '*'. If the final call/depth gate fails, samtools's asymmetry remains:
// a winning gap falls back to '*', while a winning base falls back to 'N'.
// Writes the winning and total weighted scores into out[0]/out[1] (a caller-
// owned scratch reused across the loop, so no per-position allocation). One
// implementation shared by every column — main and insertion sub-columns — so a
// call can never differ between them.
function decideCall(
  sA: number,
  sC: number,
  sG: number,
  sT: number,
  gap: number,
  totDepth: number,
  minDepth: number,
  callFract: number,
  hetFract: number,
  out: Float64Array,
) {
  const tscore = sA + sC + sG + sT + gap
  let call1 = -1
  let score1 = 0
  if (sA > score1) {
    score1 = sA
    call1 = 0
  }
  if (sC > score1) {
    score1 = sC
    call1 = 1
  }
  if (sG > score1) {
    score1 = sG
    call1 = 2
  }
  if (sT > score1) {
    score1 = sT
    call1 = 3
  }
  if (gap > score1) {
    score1 = gap
    call1 = 4
  }
  out[0] = score1
  out[1] = tscore
  if (totDepth < minDepth) {
    return call1 === 4 ? '*' : 'N'
  }
  if (call1 === -1) {
    return 'N'
  }

  const need = hetFract * score1
  let mask = 0
  let usedScore = 0
  if (sA > 0 && sA >= need) {
    mask |= 1
    usedScore += sA
  }
  if (sC > 0 && sC >= need) {
    mask |= 2
    usedScore += sC
  }
  if (sG > 0 && sG >= need) {
    mask |= 4
    usedScore += sG
  }
  if (sT > 0 && sT >= need) {
    mask |= 8
    usedScore += sT
  }
  const hasGap = gap > 0 && gap >= need
  if (hasGap) {
    usedScore += gap
  }
  if (usedScore < callFract * tscore) {
    return call1 === 4 ? '*' : 'N'
  }
  if (hasGap) {
    return mask ? IUPAC_FROM_MASK[mask]!.toLowerCase() : '*'
  }
  return IUPAC_FROM_MASK[mask]!
}

// Per-column visitor. call is the raw base/IUPAC/'*'/'N' call before any
// gapChar substitution; lowercase denotes a base+gap ambiguity. insertions is
// the (already thresholded) inserted sequence following this column, or '' if
// none. callScore/tscore are the winning and total weighted scores at this
// column (for allele-fraction reporting).
export type ConsensusColumnVisitor = (
  refPos: number,
  refCode: number,
  call: string,
  depth: number,
  callScore: number,
  tscore: number,
  insertions: string,
) => void

// The single per-position pass both the sequence and variant projections share,
// so a call can never differ between the FASTA and the VCF.
export function walkConsensus(
  reference: string,
  tally: ConsensusTally,
  opts: ConsensusOptions,
  visit: ConsensusColumnVisitor,
) {
  const minDepth = opts.minDepth ?? 1
  const callFract = opts.callFract ?? 0.75
  const hetFract = opts.hetFract ?? 0.5
  const includeInsertions = opts.includeInsertions ?? true
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

  const scratch = new Float64Array(2)
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

    const call = decideCall(
      sA,
      sC,
      sG,
      sT,
      del * GAP_WEIGHT,
      cov,
      minDepth,
      callFract,
      hetFract,
      scratch,
    )
    const callScore = scratch[0]!
    const tscore = scratch[1]!

    let insStr = ''
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
          const ichar = decideCall(
            iA,
            iC,
            iG,
            iT,
            (cov - present) * GAP_WEIGHT,
            cov,
            minDepth,
            callFract,
            hetFract,
            scratch,
          )
          if (ichar !== '*') {
            insStr += ichar
          }
        }
      }
    }

    visit(regionStart + i, refCode, call, cov, callScore, tscore, insStr)
  }
}

// reference is the region's reference sequence, aligned to tally position 0.
export function computeConsensus(
  reference: string,
  tally: ConsensusTally,
  opts: ConsensusOptions = {},
) {
  const gapChar = opts.gapChar ?? ''
  const out: string[] = []
  walkConsensus(
    reference,
    tally,
    opts,
    (_pos, _refCode, call, _d, _s, _t, ins) => {
      if (call === '*') {
        if (gapChar) {
          out.push(gapChar)
        }
      } else {
        out.push(call)
      }
      if (ins) {
        out.push(ins)
      }
    },
  )
  return out.join('')
}
