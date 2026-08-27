// What does the FILL view — "one color per type, plus low-probability &
// unmodified in blue", which for cytosine data is the methylation view — cost
// per read, and what did the char-code cytosine-context predicate buy?
//
//   node --expose-gc plugins/alignments/benches/modFillView.bench.ts
//   node --expose-gc plugins/alignments/benches/modFillView.bench.ts --skip-flag=.
//
// Flags: --rounds=<n> (default 20), --bam=<dir>, --file, --refName, --start,
// --end, --skip-flag=<?|.>, --allow-diff
//
// The harness rules (interleave, min-of-rounds, a control, an identity check
// before any timing is believed) are in agent-docs/reference/BENCHMARKING.md.
//
// THE GAP THIS FILLS. `modPhases.bench.ts` prices the BY-TYPE view — parse,
// CIGAR walk, emit — and every other bench on this path prices something inside
// those three. The fill view is a different pipeline after the parse:
// `getMethBins` bins both channels onto reference positions and walks the read
// for implicitly-unmethylated cytosines, and `extractMethylation` picks one
// state per cytosine off that. Nothing measured it, which is how a predicate
// called up to twice per aligned base went unnoticed inside it.
//
// **TWO REGIMES, AND THE FIXTURE ONLY HAS ONE OF THEM.** Whether the expensive
// half runs at all is decided by one character of the MM tag:
//
// - `C+m?` — the '?' flag says the modification status of unlisted bases is
//   UNKNOWN, so `getMethBins` must not fill them in. The context predicate then
//   runs once per CALL. **Every one of the 883 MM reads in `200x.longread.mod.bam`
//   is `C+m?`** — dorado's output — so this is what the corpus can measure
//   directly.
// - `C+m` / `C+m.` — unlisted bases are confident unmodified calls, so the fill
//   walk scans every aligned base for cytosines in context and the predicate runs
//   up to TWICE PER BASE. 43.7 Mbp of read sequence here against 0.84M calls, so
//   it is a different order of work, and `modificationsMenu`'s own help text
//   calls it "the common MM '.' mode".
//
// `--skip-flag=.` rewrites the fixture's headers to produce the second regime,
// which is the same doctoring `modCombinedCode.bench.ts` and `modPhases.bench.ts`
// do for shapes the corpus lacks. **The two regimes are two processes and two
// tables; they are not comparable to each other** — they emit different marks by
// construction, which is the whole point of the flag.
//
// ARMS, interleaved, min across rounds:
//   string-ctx  — the predicate as it was: `seq[pos]?.toLowerCase()` per probe,
//                 and `expected.toLowerCase()` beside it
//   charcode    — the predicate as it ships: `& ~0x20` on the char code
//   control     — a THIRD, separately-declared copy of `charcode`
//
// Each arm carries its own longhand copy of the whole chain below the predicate
// — the ref-pos walk, the binning, the winner selection — so no call site is
// shared between them and none can inherit another's inline caches. The
// duplication is deliberate; BENCHMARKING.md's first two catalogue entries are
// both a shared driver putting a byte-identical control at 1.14x-1.3x.
//
// The copies are pinned to the shipped code rather than trusted: `--allow-diff`
// aside, the run fails unless all three arms AND the real `extractMethylation`
// agree mark for mark, so an arm that drifted from what the display draws is a
// failed run rather than a fast row.
//
// **READ THE CONTROL AGAINST `charcode`, NOT AGAINST `string-ctx`.** The control
// duplicates arm 2, so its job is to score ~1.00 against arm 2; it scores the
// same ~1.1x against arm 1 that arm 2 does, and reading THAT as noise says the
// effect is unresolvable when it is not. The bench prints the right comparison
// on its own line for this reason.
//
// WHAT IT SAYS, on the full extent of `200x.longread.mod.bam` (883 MM reads,
// 43.7 Mbp, 0.84M calls), 2026-08-27, min-of-rounds:
//
//   skip flag   rounds   string-ctx   charcode   control   control/charcode
//   ?              25     3074.0 ms    1.118x    1.103x        0.986
//   .               5    10237.9 ms    1.511x    1.501x        0.993
//
// Byte-identical marks on both — 755,151 and 839,516 respectively, all four
// drivers agreeing.
//
// **The predicate alone is 5.64x; the phase it sits in is 1.12x or 1.51x.** That
// gap is the whole reason this file exists rather than a scratch microbench:
// BENCHMARKING.md's "a degenerate microbench" entry has a 5.2x that measured
// 1.013x on a real BAM, and the same trap was live here. The remaining time is
// the ref-pos walk, the sparse bins and the per-cytosine winner selection, which
// the predicate change does not touch.
//
// **The two regimes differ by 1.35x on the phase, which is the fill walk's own
// price.** At `--rounds=5` the '.' arm's baseline is 3.3x the '?' arm's, for the
// same reads and the same calls — that is what scanning 43.7 Mbp for cytosines
// costs over reading 0.84M called positions. A track whose basecaller omits the
// '?' flag is in a materially more expensive mode, and nothing in the UI says so.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { BamFile } from '@gmod/bam'
import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_S,
  CIGAR_X,
  getNextRefPos,
} from '@jbrowse/cigar-utils'
import {
  methylated5hmC,
  methylated5mC,
  unmethylated5mC,
} from '@jbrowse/core/ui/palette'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { getModPositions } from '@jbrowse/modifications-utils'

import { extractMethylation } from '../src/features/modification/extract.ts'

import type { ModificationEntry } from '../src/shared/webglRpcTypes.ts'
import type { BamRecord } from '@gmod/bam'
import type { Region } from '@jbrowse/core/util'
import type {
  ModWithPositions,
  ParsedModData,
} from '@jbrowse/modifications-utils'

const arg = (name: string, dflt: string) =>
  process.argv
    .find(a => a.startsWith(`--${name}=`))
    ?.slice(`--${name}=`.length) ?? dflt

const ROUNDS = Number(arg('rounds', '20'))
const BAM = arg('bam', join(process.env.HOME!, 'src/jb2bench/data'))
const FILE = arg('file', '200x.longread.mod.bam')
const REFNAME = arg('refName', 'chr22_mask')
const START = Number(arg('start', '1'))
const END = Number(arg('end', '400000'))
// '?' is the fixture's own flag; '.' doctors it into the fill-walk regime.
const SKIP_FLAG = arg('skip-flag', '?')
const ALLOW_DIFF = process.argv.includes('--allow-diff')

const ABGR_5MC = cssColorToABGR(methylated5mC)
const ABGR_UNMOD = cssColorToABGR(unmethylated5mC)
const ABGR_5HMC = cssColorToABGR(methylated5hmC)

// ---------------------------------------------------------------------------
// ARM 1: string-ctx — the predicate as it was, and the chain that calls it.

const CONTEXT_PATTERN_1: Record<string, string> = {
  CG: 'CG',
  CHG: 'CHG',
  CHH: 'CHH',
  all: 'C',
}
const COMPLEMENT_1: Record<string, string> = { a: 't', t: 'a', c: 'g', g: 'c' }

function baseMatches1(expected: string, actual: string | undefined) {
  return actual === undefined
    ? false
    : expected === 'H'
      ? actual === 'a' || actual === 'c' || actual === 't'
      : actual === expected.toLowerCase()
}

function matchesContext1(
  seq: string,
  pos: number,
  isReverse: boolean,
  context: string,
) {
  const pattern = CONTEXT_PATTERN_1[context]!
  for (let i = 0, len = pattern.length; i < len; i++) {
    const expected = pattern[i]!
    if (isReverse) {
      const actual = seq[pos - i]?.toLowerCase()
      if (
        !baseMatches1(
          expected,
          actual === undefined ? undefined : COMPLEMENT_1[actual],
        )
      ) {
        return false
      }
    } else if (!baseMatches1(expected, seq[pos + i]?.toLowerCase())) {
      return false
    }
  }
  return true
}

function forEachRefPos1(
  modifications: readonly ModWithPositions[],
  probabilities: number[] | undefined,
  cigarOps: ArrayLike<number>,
  isReverse: boolean,
  cb: (mod: ModWithPositions, ref: number, idx: number, prob: number) => void,
) {
  for (const mod of modifications) {
    const { positions, probStart, probStride } = mod
    getNextRefPos(cigarOps, positions, (ref, idx) => {
      const mmOrder = isReverse ? positions.length - 1 - idx : idx
      cb(mod, ref, idx, probabilities?.[probStart + mmOrder * probStride] ?? 0)
    })
  }
}

function methBins1(data: ParsedModData, context: string) {
  const { modifications, probabilities, cigarOps, seq, fstrand, flen } = data
  const isReverse = fstrand === -1
  const methBins: number[] = []
  const hydroxyMethBins: number[] = []
  const methProbs: number[] = []
  const hydroxyMethProbs: number[] = []
  forEachRefPos1(
    modifications,
    probabilities,
    cigarOps,
    isReverse,
    ({ type, strand, positions }, ref, idx, prob) => {
      const isMeth = type === 'm' || type === 'h'
      if (
        isMeth &&
        ref >= 0 &&
        ref < flen &&
        matchesContext1(
          seq,
          positions[idx]!,
          isReverse !== (strand === '-'),
          context,
        )
      ) {
        if (type === 'm') {
          methBins[ref] = 1
          methProbs[ref] = prob
        } else {
          hydroxyMethBins[ref] = 1
          hydroxyMethProbs[ref] = prob
        }
      }
    },
  )
  const methMods = modifications.filter(m => m.type === 'm')
  const fillUnmethylated =
    methMods.length > 0 && !methMods.some(m => m.unknownSkip)
  const fillForward = methMods.some(m => isReverse === (m.strand === '-'))
  const fillReverse = methMods.some(m => isReverse !== (m.strand === '-'))
  if (fillUnmethylated) {
    let readPos = 0
    let refPos = 0
    for (let i = 0, l = cigarOps.length; i < l; i++) {
      const packed = cigarOps[i]!
      const len = packed >>> 4
      const op = packed & 0xf
      if (op === CIGAR_S || op === CIGAR_I) {
        readPos += len
      } else if (op === CIGAR_D || op === CIGAR_N) {
        refPos += len
      } else if (op === CIGAR_M || op === CIGAR_X || op === CIGAR_EQ) {
        for (let j = 0; j < len; j++) {
          const rp = readPos + j
          const rf = refPos + j
          if (
            rf >= 0 &&
            rf < flen &&
            !methBins[rf] &&
            ((fillForward && matchesContext1(seq, rp, false, context)) ||
              (fillReverse && matchesContext1(seq, rp, true, context)))
          ) {
            methBins[rf] = 1
            methProbs[rf] = 0
          }
        }
        readPos += len
        refPos += len
      }
    }
  }
  return { methBins, hydroxyMethBins, methProbs, hydroxyMethProbs }
}

function emit1(
  readIndex: number,
  featureStart: number,
  strand: number,
  region: Region,
  data: ParsedModData,
  out: ModificationEntry[],
) {
  const { methBins, methProbs, hydroxyMethBins, hydroxyMethProbs } = methBins1(
    data,
    'CG',
  )
  const methStrand = strand === -1 ? -1 : 1
  const iStart = Math.max(0, region.start - featureStart)
  const iEnd = Math.min(data.flen, region.end - featureStart)
  for (let i = iStart; i < iEnd; i++) {
    const hasMeth = methBins[i]
    const hasHydroxy = hydroxyMethBins[i]
    if (!hasMeth && !hasHydroxy) {
      continue
    }
    const mProb = hasMeth ? (methProbs[i] ?? 0) : 0
    const hProb = hasHydroxy ? (hydroxyMethProbs[i] ?? 0) : 0
    const noModProb = Math.max(0, 1 - mProb - hProb)
    const isHydroxy = hProb > mProb && hProb > noModProb
    const isMeth = !isHydroxy && mProb > noModProb
    out.push({
      readIndex,
      position: i + featureStart,
      base: 'C',
      modType: isHydroxy ? 'h' : 'm',
      strand: methStrand,
      color: isHydroxy ? ABGR_5HMC : isMeth ? ABGR_5MC : ABGR_UNMOD,
      prob: isHydroxy ? hProb : isMeth ? mProb : noModProb,
      noMod: !isHydroxy && !isMeth,
    })
  }
}

function driveStringCtx(reads: Read[], region: Region) {
  const out: ModificationEntry[] = []
  for (const r of reads) {
    emit1(r.index, r.start, r.strand, region, r.data, out)
  }
  return out
}

// ---------------------------------------------------------------------------
// ARM 2: charcode — the predicate as it ships. Written out longhand rather than
// imported, so that arm 1 and arm 3 are the same shape as this one and no arm
// reaches its predicate through a different number of call sites.

const A_CODE = 65
const C_CODE = 67
const G_CODE = 71
const T_CODE = 84
const H_CODE = 72
const PATTERN_2: Record<string, Uint8Array> = {
  CG: Uint8Array.of(C_CODE, G_CODE),
  CHG: Uint8Array.of(C_CODE, H_CODE, G_CODE),
  CHH: Uint8Array.of(C_CODE, H_CODE, H_CODE),
  all: Uint8Array.of(C_CODE),
}
const COMPLEMENT_2 = new Int16Array(128).fill(-1)
COMPLEMENT_2[A_CODE] = T_CODE
COMPLEMENT_2[T_CODE] = A_CODE
COMPLEMENT_2[C_CODE] = G_CODE
COMPLEMENT_2[G_CODE] = C_CODE

function matchesContext2(
  seq: string,
  pos: number,
  isReverse: boolean,
  context: string,
) {
  const pattern = PATTERN_2[context]!
  for (let i = 0, len = pattern.length; i < len; i++) {
    const code = seq.charCodeAt(isReverse ? pos - i : pos + i) & ~0x20
    if (code > 127) {
      return false
    }
    const actual = isReverse ? COMPLEMENT_2[code]! : code
    const expected = pattern[i]!
    if (
      expected === H_CODE
        ? actual !== A_CODE && actual !== C_CODE && actual !== T_CODE
        : actual !== expected
    ) {
      return false
    }
  }
  return true
}

function forEachRefPos2(
  modifications: readonly ModWithPositions[],
  probabilities: number[] | undefined,
  cigarOps: ArrayLike<number>,
  isReverse: boolean,
  cb: (mod: ModWithPositions, ref: number, idx: number, prob: number) => void,
) {
  for (const mod of modifications) {
    const { positions, probStart, probStride } = mod
    getNextRefPos(cigarOps, positions, (ref, idx) => {
      const mmOrder = isReverse ? positions.length - 1 - idx : idx
      cb(mod, ref, idx, probabilities?.[probStart + mmOrder * probStride] ?? 0)
    })
  }
}

function methBins2(data: ParsedModData, context: string) {
  const { modifications, probabilities, cigarOps, seq, fstrand, flen } = data
  const isReverse = fstrand === -1
  const methBins: number[] = []
  const hydroxyMethBins: number[] = []
  const methProbs: number[] = []
  const hydroxyMethProbs: number[] = []
  forEachRefPos2(
    modifications,
    probabilities,
    cigarOps,
    isReverse,
    ({ type, strand, positions }, ref, idx, prob) => {
      const isMeth = type === 'm' || type === 'h'
      if (
        isMeth &&
        ref >= 0 &&
        ref < flen &&
        matchesContext2(
          seq,
          positions[idx]!,
          isReverse !== (strand === '-'),
          context,
        )
      ) {
        if (type === 'm') {
          methBins[ref] = 1
          methProbs[ref] = prob
        } else {
          hydroxyMethBins[ref] = 1
          hydroxyMethProbs[ref] = prob
        }
      }
    },
  )
  const methMods = modifications.filter(m => m.type === 'm')
  const fillUnmethylated =
    methMods.length > 0 && !methMods.some(m => m.unknownSkip)
  const fillForward = methMods.some(m => isReverse === (m.strand === '-'))
  const fillReverse = methMods.some(m => isReverse !== (m.strand === '-'))
  if (fillUnmethylated) {
    let readPos = 0
    let refPos = 0
    for (let i = 0, l = cigarOps.length; i < l; i++) {
      const packed = cigarOps[i]!
      const len = packed >>> 4
      const op = packed & 0xf
      if (op === CIGAR_S || op === CIGAR_I) {
        readPos += len
      } else if (op === CIGAR_D || op === CIGAR_N) {
        refPos += len
      } else if (op === CIGAR_M || op === CIGAR_X || op === CIGAR_EQ) {
        for (let j = 0; j < len; j++) {
          const rp = readPos + j
          const rf = refPos + j
          if (
            rf >= 0 &&
            rf < flen &&
            !methBins[rf] &&
            ((fillForward && matchesContext2(seq, rp, false, context)) ||
              (fillReverse && matchesContext2(seq, rp, true, context)))
          ) {
            methBins[rf] = 1
            methProbs[rf] = 0
          }
        }
        readPos += len
        refPos += len
      }
    }
  }
  return { methBins, hydroxyMethBins, methProbs, hydroxyMethProbs }
}

function emit2(
  readIndex: number,
  featureStart: number,
  strand: number,
  region: Region,
  data: ParsedModData,
  out: ModificationEntry[],
) {
  const { methBins, methProbs, hydroxyMethBins, hydroxyMethProbs } = methBins2(
    data,
    'CG',
  )
  const methStrand = strand === -1 ? -1 : 1
  const iStart = Math.max(0, region.start - featureStart)
  const iEnd = Math.min(data.flen, region.end - featureStart)
  for (let i = iStart; i < iEnd; i++) {
    const hasMeth = methBins[i]
    const hasHydroxy = hydroxyMethBins[i]
    if (!hasMeth && !hasHydroxy) {
      continue
    }
    const mProb = hasMeth ? (methProbs[i] ?? 0) : 0
    const hProb = hasHydroxy ? (hydroxyMethProbs[i] ?? 0) : 0
    const noModProb = Math.max(0, 1 - mProb - hProb)
    const isHydroxy = hProb > mProb && hProb > noModProb
    const isMeth = !isHydroxy && mProb > noModProb
    out.push({
      readIndex,
      position: i + featureStart,
      base: 'C',
      modType: isHydroxy ? 'h' : 'm',
      strand: methStrand,
      color: isHydroxy ? ABGR_5HMC : isMeth ? ABGR_5MC : ABGR_UNMOD,
      prob: isHydroxy ? hProb : isMeth ? mProb : noModProb,
      noMod: !isHydroxy && !isMeth,
    })
  }
}

function driveCharcode(reads: Read[], region: Region) {
  const out: ModificationEntry[] = []
  for (const r of reads) {
    emit2(r.index, r.start, r.strand, region, r.data, out)
  }
  return out
}

// ---------------------------------------------------------------------------
// ARM 3: control — a third, separately-declared copy of ARM 2. Whatever this
// scores against `charcode` is what the harness could resolve at that moment,
// and no ratio below it means anything.

const PATTERN_3: Record<string, Uint8Array> = {
  CG: Uint8Array.of(C_CODE, G_CODE),
  CHG: Uint8Array.of(C_CODE, H_CODE, G_CODE),
  CHH: Uint8Array.of(C_CODE, H_CODE, H_CODE),
  all: Uint8Array.of(C_CODE),
}
const COMPLEMENT_3 = new Int16Array(128).fill(-1)
COMPLEMENT_3[A_CODE] = T_CODE
COMPLEMENT_3[T_CODE] = A_CODE
COMPLEMENT_3[C_CODE] = G_CODE
COMPLEMENT_3[G_CODE] = C_CODE

function matchesContext3(
  seq: string,
  pos: number,
  isReverse: boolean,
  context: string,
) {
  const pattern = PATTERN_3[context]!
  for (let i = 0, len = pattern.length; i < len; i++) {
    const code = seq.charCodeAt(isReverse ? pos - i : pos + i) & ~0x20
    if (code > 127) {
      return false
    }
    const actual = isReverse ? COMPLEMENT_3[code]! : code
    const expected = pattern[i]!
    if (
      expected === H_CODE
        ? actual !== A_CODE && actual !== C_CODE && actual !== T_CODE
        : actual !== expected
    ) {
      return false
    }
  }
  return true
}

function forEachRefPos3(
  modifications: readonly ModWithPositions[],
  probabilities: number[] | undefined,
  cigarOps: ArrayLike<number>,
  isReverse: boolean,
  cb: (mod: ModWithPositions, ref: number, idx: number, prob: number) => void,
) {
  for (const mod of modifications) {
    const { positions, probStart, probStride } = mod
    getNextRefPos(cigarOps, positions, (ref, idx) => {
      const mmOrder = isReverse ? positions.length - 1 - idx : idx
      cb(mod, ref, idx, probabilities?.[probStart + mmOrder * probStride] ?? 0)
    })
  }
}

function methBins3(data: ParsedModData, context: string) {
  const { modifications, probabilities, cigarOps, seq, fstrand, flen } = data
  const isReverse = fstrand === -1
  const methBins: number[] = []
  const hydroxyMethBins: number[] = []
  const methProbs: number[] = []
  const hydroxyMethProbs: number[] = []
  forEachRefPos3(
    modifications,
    probabilities,
    cigarOps,
    isReverse,
    ({ type, strand, positions }, ref, idx, prob) => {
      const isMeth = type === 'm' || type === 'h'
      if (
        isMeth &&
        ref >= 0 &&
        ref < flen &&
        matchesContext3(
          seq,
          positions[idx]!,
          isReverse !== (strand === '-'),
          context,
        )
      ) {
        if (type === 'm') {
          methBins[ref] = 1
          methProbs[ref] = prob
        } else {
          hydroxyMethBins[ref] = 1
          hydroxyMethProbs[ref] = prob
        }
      }
    },
  )
  const methMods = modifications.filter(m => m.type === 'm')
  const fillUnmethylated =
    methMods.length > 0 && !methMods.some(m => m.unknownSkip)
  const fillForward = methMods.some(m => isReverse === (m.strand === '-'))
  const fillReverse = methMods.some(m => isReverse !== (m.strand === '-'))
  if (fillUnmethylated) {
    let readPos = 0
    let refPos = 0
    for (let i = 0, l = cigarOps.length; i < l; i++) {
      const packed = cigarOps[i]!
      const len = packed >>> 4
      const op = packed & 0xf
      if (op === CIGAR_S || op === CIGAR_I) {
        readPos += len
      } else if (op === CIGAR_D || op === CIGAR_N) {
        refPos += len
      } else if (op === CIGAR_M || op === CIGAR_X || op === CIGAR_EQ) {
        for (let j = 0; j < len; j++) {
          const rp = readPos + j
          const rf = refPos + j
          if (
            rf >= 0 &&
            rf < flen &&
            !methBins[rf] &&
            ((fillForward && matchesContext3(seq, rp, false, context)) ||
              (fillReverse && matchesContext3(seq, rp, true, context)))
          ) {
            methBins[rf] = 1
            methProbs[rf] = 0
          }
        }
        readPos += len
        refPos += len
      }
    }
  }
  return { methBins, hydroxyMethBins, methProbs, hydroxyMethProbs }
}

function emit3(
  readIndex: number,
  featureStart: number,
  strand: number,
  region: Region,
  data: ParsedModData,
  out: ModificationEntry[],
) {
  const { methBins, methProbs, hydroxyMethBins, hydroxyMethProbs } = methBins3(
    data,
    'CG',
  )
  const methStrand = strand === -1 ? -1 : 1
  const iStart = Math.max(0, region.start - featureStart)
  const iEnd = Math.min(data.flen, region.end - featureStart)
  for (let i = iStart; i < iEnd; i++) {
    const hasMeth = methBins[i]
    const hasHydroxy = hydroxyMethBins[i]
    if (!hasMeth && !hasHydroxy) {
      continue
    }
    const mProb = hasMeth ? (methProbs[i] ?? 0) : 0
    const hProb = hasHydroxy ? (hydroxyMethProbs[i] ?? 0) : 0
    const noModProb = Math.max(0, 1 - mProb - hProb)
    const isHydroxy = hProb > mProb && hProb > noModProb
    const isMeth = !isHydroxy && mProb > noModProb
    out.push({
      readIndex,
      position: i + featureStart,
      base: 'C',
      modType: isHydroxy ? 'h' : 'm',
      strand: methStrand,
      color: isHydroxy ? ABGR_5HMC : isMeth ? ABGR_5MC : ABGR_UNMOD,
      prob: isHydroxy ? hProb : isMeth ? mProb : noModProb,
      noMod: !isHydroxy && !isMeth,
    })
  }
}

function driveControl(reads: Read[], region: Region) {
  const out: ModificationEntry[] = []
  for (const r of reads) {
    emit3(r.index, r.start, r.strand, region, r.data, out)
  }
  return out
}

// ---------------------------------------------------------------------------
// Fidelity: the arms are copies, so pin them to the function the display calls.
// Not timed — it exists so a copy that drifted fails the run.

function driveShipped(reads: Read[], region: Region) {
  const out: ModificationEntry[] = []
  for (const r of reads) {
    extractMethylation(r.index, r.start, r.strand, region, r.data, out, {
      fillUnmarked: true,
    })
  }
  return out
}

// ---------------------------------------------------------------------------

interface Read {
  index: number
  start: number
  strand: -1 | 0 | 1
  data: ParsedModData
}

function time(fn: () => unknown) {
  globalThis.gc?.()
  const t0 = performance.now()
  fn()
  return performance.now() - t0
}

function lines(marks: ModificationEntry[]) {
  return marks.map(
    m =>
      `${m.readIndex} ${m.position} ${m.modType} ${m.strand} ${m.color} ${m.prob.toFixed(6)} ${m.noMod ? 1 : 0}`,
  )
}

function firstDifference(a: string[], b: string[]) {
  if (a.length !== b.length) {
    return `length ${a.length} vs ${b.length}`
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return `entry ${i}: "${a[i]}" vs "${b[i]}"`
    }
  }
  return ''
}

// `C+m?` -> `C+m`, positions and ML untouched. Only the skip flag moves, so the
// calls are identical and what changes is whether getMethBins may fill the
// unlisted cytosines — which is the second regime this bench exists to reach.
function reflag(mm: string, flag: string) {
  return mm
    .split(';')
    .filter(Boolean)
    .map(group => {
      const comma = group.indexOf(',')
      const header = comma === -1 ? group : group.slice(0, comma)
      const rest = comma === -1 ? '' : group.slice(comma)
      const bare = /[.?]$/.test(header) ? header.slice(0, -1) : header
      return (flag === '.' ? bare : bare + flag) + rest
    })
    .join(';')
}

function toReads(records: BamRecord[]): Read[] {
  const reads: Read[] = []
  for (let i = 0; i < records.length; i++) {
    const r = records[i]!
    const rawMm = (r.getTag('MM') ?? r.getTag('Mm')) as string | undefined
    const ml = (r.getTag('ML') ?? r.getTag('Ml')) as
      | ArrayLike<number>
      | undefined
    const ops = r.NUMERIC_CIGAR as Uint32Array | undefined
    if (!rawMm || !ml || !ops?.length) {
      continue
    }
    const mm = reflag(rawMm, SKIP_FLAG)
    const strand: -1 | 0 | 1 = r.strand === -1 ? -1 : 1
    const seq = r.seq
    reads.push({
      index: i,
      start: r.start,
      strand,
      data: {
        modifications: getModPositions(mm, seq, strand),
        // The scaled numbers getMethBins reads. Built once here rather than per
        // round: every arm consumes the same object, and it is the parse the
        // change under test sits after.
        probabilities: Array.from(ml, v => (+v + 0.5) / 256),
        cigarOps: ops,
        seq,
        fstrand: strand,
        flen: r.end - r.start,
      },
    })
  }
  return reads
}

async function main() {
  const path = join(BAM, FILE)
  readFileSync(path.replace(/\.bam$/, '.bam.bai'))
  const bam = new BamFile({ bamPath: path, baiPath: `${path}.bai` })
  await bam.getHeader()
  const records = await bam.getRecordsForRange(REFNAME, START, END)
  const reads = toReads(records)
  const region = {
    refName: REFNAME,
    start: START,
    end: END,
    assemblyName: 'bench',
  } as Region

  const calls = reads.reduce(
    (n, r) =>
      n + r.data.modifications.reduce((k, m) => k + m.positions.length, 0),
    0,
  )
  const bases = reads.reduce((n, r) => n + r.data.seq.length, 0)
  const fills = reads.filter(r =>
    r.data.modifications.some(m => m.type === 'm' && !m.unknownSkip),
  ).length
  console.log(
    `${FILE} ${REFNAME}:${START}-${END} — ${reads.length} MM reads, ${(bases / 1e6).toFixed(1)} Mbp, ${(calls / 1e6).toFixed(2)}M calls`,
  )
  console.log(
    `skip flag '${SKIP_FLAG}' — ${fills}/${reads.length} reads run the implicit-unmethylated fill walk`,
  )

  // Warm every arm identically, INCLUDING the fidelity arm, so no call site is
  // left monomorphic while its neighbours have gone polymorphic (the 0.61x
  // control in BENCHMARKING.md).
  const outStr = driveStringCtx(reads, region)
  const outChar = driveCharcode(reads, region)
  const outCtl = driveControl(reads, region)
  const outShipped = driveShipped(reads, region)

  // A row that emits nothing is a broken fixture, not a fast arm.
  if (outChar.length === 0) {
    console.error('FAIL: no marks emitted — the fixture cannot produce them')
    process.exit(1)
  }

  const ref = lines(outChar)
  for (const [name, out] of [
    ['string-ctx', outStr],
    ['control', outCtl],
    ['shipped extractMethylation', outShipped],
  ] as const) {
    const diff = firstDifference(lines(out), ref)
    if (diff) {
      console.error(`FAIL: ${name} disagrees with charcode — ${diff}`)
      if (!ALLOW_DIFF) {
        process.exit(1)
      }
    }
  }
  console.log(
    `identity: all arms agree on ${outChar.length.toLocaleString()} marks`,
  )

  const best = { 'string-ctx': Infinity, charcode: Infinity, control: Infinity }
  const emitted = { 'string-ctx': 0, charcode: 0, control: 0 }
  for (let i = 0; i < ROUNDS; i++) {
    let out: ModificationEntry[] = []
    best['string-ctx'] = Math.min(
      best['string-ctx'],
      time(() => {
        out = driveStringCtx(reads, region)
      }),
    )
    emitted['string-ctx'] = out.length
    best.charcode = Math.min(
      best.charcode,
      time(() => {
        out = driveCharcode(reads, region)
      }),
    )
    emitted.charcode = out.length
    best.control = Math.min(
      best.control,
      time(() => {
        out = driveControl(reads, region)
      }),
    )
    emitted.control = out.length
  }

  console.log(`\nmin of ${ROUNDS} rounds:`)
  console.log('  arm           ms      vs string-ctx   marks')
  for (const name of ['string-ctx', 'charcode', 'control'] as const) {
    console.log(
      `  ${name.padEnd(12)} ${best[name].toFixed(1).padStart(7)}   ${(best['string-ctx'] / best[name]).toFixed(3).padStart(7)}x   ${emitted[name].toLocaleString().padStart(9)}`,
    )
  }
  console.log(
    `\ncontrol vs charcode: ${(best.charcode / best.control).toFixed(3)}x — a row whose control is far from 1.00 measured nothing`,
  )
}

await main()
