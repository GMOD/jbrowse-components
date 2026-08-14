// What a COMBINED modification code costs, and how much of it is the same walk
// done once per type.
//
//   node --expose-gc plugins/alignments/benches/modCombinedCode.bench.ts --tag=mh
//   node --expose-gc plugins/alignments/benches/modCombinedCode.bench.ts --tag=m
//
// Flags: --rounds=<n> (default 60), --bam=<dir>, --refName, --start, --end,
// --tag=<m|mh|both> (default both, with the warning below)
//
// **The `mh` row needs ~100 rounds, and fewer does not just widen it — it moves
// it.** Measured on the same machine minutes apart: 20 rounds gave a 0.893x
// control, 40 gave 1.149x, 100 gave 1.007x, and the claimed ratio wandered
// 1.875x -> 2.152x -> 2.069x with it. The `mh` arms allocate twice the position
// arrays and emit 43% more marks, so each round is ~2x the `m` round and the min
// takes proportionally longer to plateau. BENCHMARKING.md's "too few rounds
// against a warming cache" entry, from the side where the ARM is what is slow.
// Don't quote a row whose control is not within a couple of percent of 1.00.
//
// The harness rules (interleave, min-of-rounds, a byte-identical control, an
// identity check before any timing is believed) are in
// agent-docs/reference/BENCHMARKING.md. Read that before changing this.
//
// THE QUESTION. `getModPositions` keeps the whole delta walk inside
// `processType`, which is called once per character of a multi-char lowercase
// type string. `C+mh` therefore walks the read sequence TWICE and
// allocates two identical position arrays. Only `probStart` differs between the
// two entries it produces. `forEachMaxProbMod` has the same duplication one
// layer down: it walks the CIGAR once per mod entry, and a combined code's
// entries carry identical positions, so the second walk visits exactly the
// reference offsets the first did.
//
// Both halves are the same fix — walk once per MM GROUP — and the second is only
// possible because of the first: sharing the positions array BY IDENTITY is what
// lets the CIGAR walk recognize which entries are the same walk.
//
// THREE ARMS:
//   shipped  — the per-type walk plus the per-entry CIGAR walk, declared here so
//              this bench keeps measuring both shapes after the fix lands
//   hoisted  — one delta walk per group into one shared array, and one CIGAR
//              walk per group with the winner picked across the group's types
//   control  — a second, separately-declared copy of `shipped`
//
// WHY THE FIXTURE HAS TO BE DOCTORED. Every modBAM in either repo is one MM
// group of one type (`200x.longread.mod.bam` is 285 reads, all `C+m?`), so no
// benchmark here has ever seen a combined code. The `mh` arm synthesizes one by
// rewriting the `C+m?` header to `C+mh?` and interleaving a second ML byte per
// position. The delta list is untouched, so **every position is unchanged** and
// the only thing added is the second type at those same positions — which is
// exactly what a real `C+mh` read is.
//
// **AND REAL DORADO OUTPUT DOES NOT USE ONE.** This header used to call `C+mh`
// "ONT's 5mCG_5hmCG model, and the standard output of anything calling
// hydroxymethyl". Checked against ONT's public chromatin-accessibility run for
// HG002 (`ont.6ma.chr20.bam`, whose header names
// `modbase_models=..._5mCG_5hmCG@v1,..._6mA@v1`): **all 8,166 reads are
// `A+a.;C+h?;C+m?` and not one carries a combined code.** Dorado emits 5mC and
// 5hmC as two SEPARATE MM groups on C.
//
// So the dedup this bench prices does not fire on that data at all, and what the
// commit actually bought there is the single-type row — the per-group closure,
// which applies once per group and so three times per read. The combined form is
// still legal, still what the spec describes, and still what some producers emit;
// it is just not the ONT default it was described as.
//
// It also leaves a bigger opportunity that this shape cannot reach: `C+h?` and
// `C+m?` are two groups on the SAME base, so their delta lists are equal and
// their positions identical — but as separate groups they get separate arrays and
// separate CIGAR walks, which the identity test in `forEachMaxProbMod` correctly
// declines to merge. Sharing them has to be decided at PARSE time, by comparing
// the delta strings. That is in TODO.md.
//
// **A combined code is not the same thing as a file with several modification
// types, and the difference decides whether this fix applies.** A combined code
// is several types on the SAME canonical base at the SAME positions, with ML
// interleaved — `C+mh` is 5mC and 5hmC at every cytosine. A Fiber-seq read
// carries `C+m,…;A+a,…`: 5mC on cytosine and 6mA on adenine, necessarily
// different positions, necessarily separate groups, and correctly NOT
// deduplicated by anything here. Multi-group is the commoner shape of the two
// and neither this bench nor any fixture in either corpus has one; see TODO's
// "Walk the CIGAR once for a read's whole MM tag" for what it costs and for the
// corpus gap.
//
// The synthetic h byte is the m byte's complement, so the winner alternates with
// the call rather than sitting on one branch. That is a statement about this
// bench, not about ONT's h distribution (real h is low almost everywhere); the
// walk cost under test does not depend on which type wins, only on how many
// there are.
//
// WHAT IT SAYS, on `200x.longread.mod.bam` at chr22_mask:124000-143000, 285 MM
// reads of mean 50 kb, `--rounds=100`, one tag per process (2026-08-14, load
// 7-15):
//
//   tag             shipped   hoisted            control   marks
//   C+m  (1 type)   184.87    159.20    1.161x   0.990     148,045
//   C+mh (2 types)  353.15    170.65    2.069x   1.007     211,876
//
// The shape is the argument, not either ratio. Read the table down the columns
// rather than across: **shipped 1.91x when a second type joins the same tag,
// hoisted 1.07x.** O(types) becomes O(1), and the 7% hoisted does grow is the
// second ML lookup per position plus 43% more marks to emit — not a second walk.
//
// The single-type row is the surprise, and it is why this landed for everyone
// rather than only for `C+mh` files. 1.16x with a 0.990 control, on a corpus that
// has exactly one type per tag and so does exactly one walk either way. What it
// buys there is not a walk but the CLOSURE: `processType` is allocated per MM
// group and called through the variable holding it, and hoisting its body into
// the loop lets V8 keep the walk in the enclosing frame.
//
// AND THE SAME THING AT 3.1x THE SIZE, `--start=1 --end=400000` (the file's whole
// extent: 883 reads, 43.7 Mbp, 0.84M calls), `--rounds=40`, load 3.6:
//
//   tag             shipped    hoisted            control
//   C+m  (1 type)    632.04     534.98   1.181x   1.014
//   C+mh (2 types)  1027.77     552.07   1.862x   0.997
//
// **The ratio moves and the shape does not.** C+mh falls from 2.07x to 1.86x
// while C+m is 1.16x/1.18x at both sizes — so a bigger fixture did not turn this
// into a bigger win, and quoting the 19 kb window's 2.07x as the number would
// have overstated it by a tenth. What survives the size change is the argument:
// shipped costs 1.63x for a second type here (1.91x on the small window), hoisted
// 1.03x (1.07x). The flat row stays flat.
//
// The full extent is the better default for anything on this path, and the
// sibling benches (`modPhases`, `cigarWalkShape`, `mmParseShape`) use it. This
// one keeps the 19 kb window because its numbers were taken there and the two
// sizes are printed together above.
//
// Written out longhand, three times. Do NOT refactor the arms into one driver
// parameterized by a flag — a shared driver makes the call site polymorphic and
// hands every arm one set of inline caches, which has scored a byte-identical
// control at 1.14x in this repo's sibling benches.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { BamFile } from '@gmod/bam'
import { getNextRefPos } from '@jbrowse/cigar-utils'
import { isSingleModType, parseModHeader } from '@jbrowse/modifications-utils'

import type { BamRecord } from '@gmod/bam'

const arg = (name: string, dflt: string) =>
  process.argv
    .find(a => a.startsWith(`--${name}=`))
    ?.slice(`--${name}=`.length) ?? dflt

const ROUNDS = Number(arg('rounds', '60'))
const BAM = arg('bam', join(process.env.HOME!, 'src/jb2bench/data'))
const REFNAME = arg('refName', 'chr22_mask')
const START = Number(arg('start', '124000'))
const END = Number(arg('end', '143000'))
// One tag per process. The two tags are two FIXTURES as far as V8 is concerned,
// and BENCHMARKING.md's dataset-contamination entry is about exactly that: the
// arm functions are shared between them, so the second tag runs against inline
// caches the first warmed. Both tags in one process is fine for a smoke test and
// wrong for a number.
const TAG = arg('tag', 'both')

const THRESHOLD = 0.5

const COMPLEMENT_CODE: Record<number, number> = {
  65: 84,
  84: 65,
  67: 71,
  71: 67,
  78: 78,
}

interface Read {
  index: number
  start: number
  strand: -1 | 0 | 1
  seq: string
  mm: string
  ml: ArrayLike<number>
  ops: Uint32Array | number[]
}

interface Mod {
  type: string
  base: string
  strand: string
  unknownSkip: boolean
  positions: number[]
  probStart: number
  probStride: number
}

interface Entry {
  readIndex: number
  position: number
  base: string
  modType: string
  strand: number
  prob: number
}

// ---------------------------------------------------------------------------
// ARM 1: shipped — the walk inside processType, one CIGAR walk per entry.

function modPositionsShipped(mm: string, fseq: string, fstrand: number) {
  const seqLength = fseq.length
  const isRev = fstrand === -1
  const mods = mm.split(';')
  const result: Mod[] = []
  let mlBase = 0

  for (const mod of mods) {
    if (mod === '') {
      continue
    }
    const split = mod.split(',')
    const basemod = split[0]!
    const {
      base,
      strand,
      typestr,
      mod: skipFlag,
    } = parseModHeader(basemod, mod)
    const unknownSkip = skipFlag === '?'
    const isSingleType = isSingleModType(typestr)
    const nTypes = isSingleType ? 1 : typestr.length

    const processType = (type: string, groupIndex: number) => {
      const splitLength = split.length
      let currPos = 0
      const baseCode = base.charCodeAt(0)
      const targetCode = isRev
        ? (COMPLEMENT_CODE[baseCode] ?? baseCode)
        : baseCode
      const isN = base === 'N'
      const positions = isRev ? new Array<number>(splitLength - 1) : []
      let writeIndex = isRev ? splitLength - 2 : 0

      for (let i = 1; i < splitLength; i++) {
        let delta = +split[i]!
        do {
          const seqCode = isRev
            ? fseq.charCodeAt(seqLength - 1 - currPos)
            : fseq.charCodeAt(currPos)
          if (isN || seqCode === targetCode) {
            delta--
          }
          currPos++
        } while (delta >= 0 && currPos < seqLength)

        if (isRev) {
          positions[writeIndex--] = seqLength - currPos
        } else {
          positions[writeIndex++] = currPos - 1
        }
      }

      result.push({
        type,
        base,
        strand,
        unknownSkip,
        positions,
        probStart: mlBase + groupIndex,
        probStride: nTypes,
      })
    }

    if (isSingleType) {
      processType(typestr, 0)
    } else {
      for (let j = 0, len = typestr.length; j < len; j++) {
        processType(typestr[j]!, j)
      }
    }
    mlBase += (split.length - 1) * nTypes
  }

  return result
}

function runShipped(reads: Read[]) {
  const entries: Entry[] = []
  for (const r of reads) {
    const mods = modPositionsShipped(r.mm, r.seq, r.strand)
    const isRev = r.strand === -1
    const modStrand = isRev ? -1 : 1
    const ml = r.ml
    if (mods.length === 0) {
      continue
    }

    let span = 0
    for (let i = 0, l = r.ops.length; i < l; i++) {
      const packed = r.ops[i]!
      const op = packed & 0xf
      // D, N, M, X, = — the ops that consume reference
      if (op === 2 || op === 3 || op === 0 || op === 7 || op === 8) {
        span += packed >>> 4
      }
    }
    const best = new Uint16Array(span + 1)
    let firstRef = -1
    let lastRef = -1

    for (let m = 0, ml2 = mods.length; m < ml2; m++) {
      const mod = mods[m]!
      const { positions, probStart, probStride } = mod
      const posLen = positions.length
      const tag = (m + 1) << 8
      getNextRefPos(r.ops, positions, (ref, idx) => {
        const mmOrder = isRev ? posLen - 1 - idx : idx
        const byte = ml[probStart + mmOrder * probStride] ?? 0
        const prev = best[ref]!
        if (prev === 0 || (prev & 0xff) < byte) {
          best[ref] = tag | byte
          if (firstRef < 0 || ref < firstRef) {
            firstRef = ref
          }
          if (ref > lastRef) {
            lastRef = ref
          }
        }
      })
    }

    if (firstRef < 0) {
      continue
    }
    for (let ref = firstRef; ref <= lastRef; ref++) {
      const packed = best[ref]!
      if (packed === 0) {
        continue
      }
      const prob = ((packed & 0xff) + 0.5) / 256
      if (prob < THRESHOLD) {
        continue
      }
      const mod = mods[(packed >>> 8) - 1]!
      entries.push({
        readIndex: r.index,
        position: r.start + ref,
        base: mod.base,
        modType: mod.type,
        strand: modStrand,
        prob,
      })
    }
  }
  return entries
}

// ---------------------------------------------------------------------------
// ARM 2: hoisted — one delta walk per GROUP into one array the group's entries
// share by identity, and one CIGAR walk per run of entries that share it.

function modPositionsHoisted(mm: string, fseq: string, fstrand: number) {
  const seqLength = fseq.length
  const isRev = fstrand === -1
  const mods = mm.split(';')
  const result: Mod[] = []
  let mlBase = 0

  for (const mod of mods) {
    if (mod === '') {
      continue
    }
    const split = mod.split(',')
    const basemod = split[0]!
    const {
      base,
      strand,
      typestr,
      mod: skipFlag,
    } = parseModHeader(basemod, mod)
    const unknownSkip = skipFlag === '?'
    const isSingleType = isSingleModType(typestr)
    const nTypes = isSingleType ? 1 : typestr.length

    const splitLength = split.length
    const nPositions = splitLength - 1
    const baseCode = base.charCodeAt(0)
    const targetCode = isRev
      ? (COMPLEMENT_CODE[baseCode] ?? baseCode)
      : baseCode
    const isN = base === 'N'
    const positions = isRev ? new Array<number>(nPositions) : []
    let writeIndex = isRev ? nPositions - 1 : 0
    let currPos = 0

    for (let i = 1; i < splitLength; i++) {
      let delta = +split[i]!
      do {
        const seqCode = isRev
          ? fseq.charCodeAt(seqLength - 1 - currPos)
          : fseq.charCodeAt(currPos)
        if (isN || seqCode === targetCode) {
          delta--
        }
        currPos++
      } while (delta >= 0 && currPos < seqLength)

      if (isRev) {
        positions[writeIndex--] = seqLength - currPos
      } else {
        positions[writeIndex++] = currPos - 1
      }
    }

    if (isSingleType) {
      result.push({
        type: typestr,
        base,
        strand,
        unknownSkip,
        positions,
        probStart: mlBase,
        probStride: 1,
      })
    } else {
      for (let j = 0, len = typestr.length; j < len; j++) {
        result.push({
          type: typestr[j]!,
          base,
          strand,
          unknownSkip,
          positions,
          probStart: mlBase + j,
          probStride: nTypes,
        })
      }
    }
    mlBase += nPositions * nTypes
  }

  return result
}

function runHoisted(reads: Read[]) {
  const entries: Entry[] = []
  for (const r of reads) {
    const mods = modPositionsHoisted(r.mm, r.seq, r.strand)
    const isRev = r.strand === -1
    const modStrand = isRev ? -1 : 1
    const ml = r.ml
    const nMods = mods.length
    if (nMods === 0) {
      continue
    }

    let span = 0
    for (let i = 0, l = r.ops.length; i < l; i++) {
      const packed = r.ops[i]!
      const op = packed & 0xf
      // D, N, M, X, = — the ops that consume reference
      if (op === 2 || op === 3 || op === 0 || op === 7 || op === 8) {
        span += packed >>> 4
      }
    }
    const best = new Uint16Array(span + 1)
    let firstRef = -1
    let lastRef = -1

    for (let m = 0; m < nMods;) {
      const mod = mods[m]!
      const positions = mod.positions
      // The group's entries are consecutive and share the array by identity, so
      // a linear scan finds the run.
      let end = m + 1
      while (end < nMods && mods[end]!.positions === positions) {
        end++
      }
      const posLen = positions.length
      if (end - m === 1) {
        const { probStart, probStride } = mod
        const tag = (m + 1) << 8
        getNextRefPos(r.ops, positions, (ref, idx) => {
          const mmOrder = isRev ? posLen - 1 - idx : idx
          const byte = ml[probStart + mmOrder * probStride] ?? 0
          const prev = best[ref]!
          if (prev === 0 || (prev & 0xff) < byte) {
            best[ref] = tag | byte
            if (firstRef < 0 || ref < firstRef) {
              firstRef = ref
            }
            if (ref > lastRef) {
              lastRef = ref
            }
          }
        })
      } else {
        const groupStart = m
        const groupEnd = end
        getNextRefPos(r.ops, positions, (ref, idx) => {
          const mmOrder = isRev ? posLen - 1 - idx : idx
          // First maximum wins, which is the order the per-entry walks resolved
          // ties in.
          let bestByte = -1
          let bestIdx = groupStart
          for (let k = groupStart; k < groupEnd; k++) {
            const g = mods[k]!
            const byte = ml[g.probStart + mmOrder * g.probStride] ?? 0
            if (byte > bestByte) {
              bestByte = byte
              bestIdx = k
            }
          }
          const prev = best[ref]!
          if (prev === 0 || (prev & 0xff) < bestByte) {
            best[ref] = ((bestIdx + 1) << 8) | bestByte
            if (firstRef < 0 || ref < firstRef) {
              firstRef = ref
            }
            if (ref > lastRef) {
              lastRef = ref
            }
          }
        })
      }
      m = end
    }

    if (firstRef < 0) {
      continue
    }
    for (let ref = firstRef; ref <= lastRef; ref++) {
      const packed = best[ref]!
      if (packed === 0) {
        continue
      }
      const prob = ((packed & 0xff) + 0.5) / 256
      if (prob < THRESHOLD) {
        continue
      }
      const mod = mods[(packed >>> 8) - 1]!
      entries.push({
        readIndex: r.index,
        position: r.start + ref,
        base: mod.base,
        modType: mod.type,
        strand: modStrand,
        prob,
      })
    }
  }
  return entries
}

// ---------------------------------------------------------------------------
// ARM 3: control — a second, separately-declared copy of ARM 1.

function modPositionsControl(mm: string, fseq: string, fstrand: number) {
  const seqLength = fseq.length
  const isRev = fstrand === -1
  const mods = mm.split(';')
  const result: Mod[] = []
  let mlBase = 0

  for (const mod of mods) {
    if (mod === '') {
      continue
    }
    const split = mod.split(',')
    const basemod = split[0]!
    const {
      base,
      strand,
      typestr,
      mod: skipFlag,
    } = parseModHeader(basemod, mod)
    const unknownSkip = skipFlag === '?'
    const isSingleType = isSingleModType(typestr)
    const nTypes = isSingleType ? 1 : typestr.length

    const processType = (type: string, groupIndex: number) => {
      const splitLength = split.length
      let currPos = 0
      const baseCode = base.charCodeAt(0)
      const targetCode = isRev
        ? (COMPLEMENT_CODE[baseCode] ?? baseCode)
        : baseCode
      const isN = base === 'N'
      const positions = isRev ? new Array<number>(splitLength - 1) : []
      let writeIndex = isRev ? splitLength - 2 : 0

      for (let i = 1; i < splitLength; i++) {
        let delta = +split[i]!
        do {
          const seqCode = isRev
            ? fseq.charCodeAt(seqLength - 1 - currPos)
            : fseq.charCodeAt(currPos)
          if (isN || seqCode === targetCode) {
            delta--
          }
          currPos++
        } while (delta >= 0 && currPos < seqLength)

        if (isRev) {
          positions[writeIndex--] = seqLength - currPos
        } else {
          positions[writeIndex++] = currPos - 1
        }
      }

      result.push({
        type,
        base,
        strand,
        unknownSkip,
        positions,
        probStart: mlBase + groupIndex,
        probStride: nTypes,
      })
    }

    if (isSingleType) {
      processType(typestr, 0)
    } else {
      for (let j = 0, len = typestr.length; j < len; j++) {
        processType(typestr[j]!, j)
      }
    }
    mlBase += (split.length - 1) * nTypes
  }

  return result
}

function runControl(reads: Read[]) {
  const entries: Entry[] = []
  for (const r of reads) {
    const mods = modPositionsControl(r.mm, r.seq, r.strand)
    const isRev = r.strand === -1
    const modStrand = isRev ? -1 : 1
    const ml = r.ml
    if (mods.length === 0) {
      continue
    }

    let span = 0
    for (let i = 0, l = r.ops.length; i < l; i++) {
      const packed = r.ops[i]!
      const op = packed & 0xf
      // D, N, M, X, = — the ops that consume reference
      if (op === 2 || op === 3 || op === 0 || op === 7 || op === 8) {
        span += packed >>> 4
      }
    }
    const best = new Uint16Array(span + 1)
    let firstRef = -1
    let lastRef = -1

    for (let m = 0, ml2 = mods.length; m < ml2; m++) {
      const mod = mods[m]!
      const { positions, probStart, probStride } = mod
      const posLen = positions.length
      const tag = (m + 1) << 8
      getNextRefPos(r.ops, positions, (ref, idx) => {
        const mmOrder = isRev ? posLen - 1 - idx : idx
        const byte = ml[probStart + mmOrder * probStride] ?? 0
        const prev = best[ref]!
        if (prev === 0 || (prev & 0xff) < byte) {
          best[ref] = tag | byte
          if (firstRef < 0 || ref < firstRef) {
            firstRef = ref
          }
          if (ref > lastRef) {
            lastRef = ref
          }
        }
      })
    }

    if (firstRef < 0) {
      continue
    }
    for (let ref = firstRef; ref <= lastRef; ref++) {
      const packed = best[ref]!
      if (packed === 0) {
        continue
      }
      const prob = ((packed & 0xff) + 0.5) / 256
      if (prob < THRESHOLD) {
        continue
      }
      const mod = mods[(packed >>> 8) - 1]!
      entries.push({
        readIndex: r.index,
        position: r.start + ref,
        base: mod.base,
        modType: mod.type,
        strand: modStrand,
        prob,
      })
    }
  }
  return entries
}

// ---------------------------------------------------------------------------

function serialize(out: Entry[]) {
  const lines: string[] = []
  for (const e of out) {
    lines.push(
      `${e.readIndex} ${e.position} ${e.modType} ${e.base} ${e.strand} ` +
        e.prob.toFixed(6),
    )
  }
  return lines
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

function time(fn: () => unknown) {
  globalThis.gc?.()
  const t0 = performance.now()
  fn()
  return performance.now() - t0
}

function toReads(records: BamRecord[]): Read[] {
  const reads: Read[] = []
  for (let i = 0; i < records.length; i++) {
    const r = records[i]!
    const mm = (r.getTag('MM') ?? r.getTag('Mm')) as string | undefined
    const ml = (r.getTag('ML') ?? r.getTag('Ml')) as
      | ArrayLike<number>
      | undefined
    if (!mm || !ml) {
      continue
    }
    reads.push({
      index: i,
      start: r.start,
      strand: r.strand === -1 ? -1 : 1,
      seq: r.seq,
      mm,
      ml,
      ops: r.NUMERIC_CIGAR as Uint32Array,
    })
  }
  return reads
}

// `C+m?` -> `C+mh?`, positions untouched, ML interleaved to two bytes per
// position. Every read here is single-group `C+m?`, checked below rather than
// assumed: a read this does not recognize is left alone and counted.
function toCombined(reads: Read[]) {
  let rewritten = 0
  const out = reads.map(r => {
    const groups = r.mm.split(';').filter(Boolean)
    if (groups.length !== 1 || !groups[0]!.startsWith('C+m')) {
      return r
    }
    const split = groups[0]!.split(',')
    const header = parseModHeader(split[0]!, groups[0]!)
    if (header.typestr !== 'm' || split.length - 1 !== r.ml.length) {
      return r
    }
    rewritten++
    const n = r.ml.length
    const ml = new Uint8Array(n * 2)
    for (let i = 0; i < n; i++) {
      const m = r.ml[i]!
      ml[i * 2] = m
      ml[i * 2 + 1] = 255 - m
    }
    return {
      ...r,
      mm: `C+mh${header.mod === '.' ? '' : header.mod},${split.slice(1).join(',')};`,
      ml,
    }
  })
  return { reads: out, rewritten }
}

async function main() {
  if (!globalThis.gc) {
    console.error('run with --expose-gc\n')
  }
  const path = join(BAM, '200x.longread.mod.bam')
  try {
    readFileSync(path, { flag: 'r' })
  } catch {
    console.log(`not present at ${path}, nothing to measure`)
    return
  }
  const bam = new BamFile({ bamPath: path, baiPath: `${path}.bai` })
  await bam.getHeader()
  const records = await bam.getRecordsForRange(REFNAME, START, END)
  const single = toReads(records)
  if (single.length === 0) {
    console.log('no MM/ML reads in range')
    return
  }
  const { reads: combined, rewritten } = toCombined(single)

  const tags = (TAG === 'both' ? ['m', 'mh'] : [TAG]) as ('m' | 'mh')[]
  if (TAG === 'both') {
    console.log(
      'NOTE: both tags in one process. Only the FIRST row is trustworthy —\n' +
        'see the --tag= note in this file.\n',
    )
  }
  console.log(
    `combined modification code: per-type walk vs one walk per group\n` +
      `200x.longread.mod.bam ${REFNAME}:${START}-${END}, ` +
      `min of ${ROUNDS} rotated rounds\n` +
      `  ${single.length} MM reads, ${rewritten} rewritten to C+mh\n`,
  )

  for (const tag of tags) {
    const reads = tag === 'm' ? single : combined

    // Warm every arm identically before timing — an arm that skipped this would
    // enter the loop with a monomorphic call site while the others had gone
    // polymorphic, which has scored a fake 0.61x control in this repo.
    const outShipped = serialize(runShipped(reads))
    const outHoisted = serialize(runHoisted(reads))
    const outControl = serialize(runControl(reads))

    const diffHoisted = firstDifference(outShipped, outHoisted)
    const diffControl = firstDifference(outShipped, outControl)
    if (diffControl) {
      throw new Error(
        `the control disagrees with the baseline it was copied from (${diffControl}) — the harness is broken`,
      )
    }

    const best = { ship: Infinity, hoist: Infinity, ctl: Infinity }
    const sides = [
      { k: 'ship' as const, run: () => runShipped(reads) },
      { k: 'hoist' as const, run: () => runHoisted(reads) },
      { k: 'ctl' as const, run: () => runControl(reads) },
    ]
    for (let round = 0; round < ROUNDS; round++) {
      for (let i = 0; i < sides.length; i++) {
        const side = sides[(round + i) % sides.length]!
        best[side.k] = Math.min(best[side.k], time(side.run))
      }
    }
    const x = (v: number) => `${(best.ship / v).toFixed(3)}x`
    console.log(
      `C+${tag} (${tag.length} type${tag.length > 1 ? 's' : ''}), ` +
        `${outShipped.length} marks emitted\n` +
        `  shipped   ${best.ship.toFixed(2).padStart(8)} ms\n` +
        `  hoisted   ${best.hoist.toFixed(2).padStart(8)} ms   ${x(best.hoist)}   ` +
        `output ${diffHoisted ? `DIFFERS — ${diffHoisted}` : 'identical'}\n` +
        `  control   ${best.ctl.toFixed(2).padStart(8)} ms   ${x(best.ctl)}   <- noise floor\n`,
    )
  }
}

await main()
