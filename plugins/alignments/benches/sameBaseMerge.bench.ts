// Two MM groups on the SAME canonical base call the same positions. Ours walks
// for both.
//
//   node --expose-gc plugins/alignments/benches/sameBaseMerge.bench.ts
//   node --expose-gc plugins/alignments/benches/sameBaseMerge.bench.ts \
//     --file=200x.longread.mod.bam --refName=chr22_mask --start=1 --end=400000
//
// Flags: --rounds=<n> (default 40), --bam=<dir>, --file, --refName, --start,
// --end
//
// The harness rules are in agent-docs/reference/BENCHMARKING.md.
//
// THE QUESTION. Dorado's 5mCG_5hmCG model emits `C+h?;C+m?` — 5mC and 5hmC as
// two SEPARATE MM groups, not as the combined `C+mh` code the SAM spec allows.
// Both groups count cytosines, and both carry the SAME delta list, so their
// positions are equal element for element. `getModPositions` restarts
// `currPos = 0` per group and walks the read sequence for each of them, then
// `forEachMaxProbMod` walks the CIGAR for each of them, because its grouping test
// is array IDENTITY and these are two separately-allocated arrays.
//
// It is right to be an identity test — equal-by-accident arrays must not be
// folded, and htslib coalesces by the same rule (a pointer compare into the MM
// string, `state->MM[j] == MMptr`). So the merge has to be decided one layer
// earlier, at PARSE time, where the delta lists are still in hand and can be
// compared directly. Do that and the identity grouping picks the CIGAR walk up
// for free — which is why the emit below is SHARED between the arms rather than
// written twice.
//
// **THE KEY IS EXACTLY WHAT THE WALK READS, PLUS ONE.** The positions a group
// produces are determined by its canonical base and its delta list (`fseq` and
// `fstrand` are per read, not per group), so those two are sufficient. This arm
// also compares the MM strand, which the walk does NOT currently read — a
// deliberate over-tightening, so the test stays sound rather than silently wrong
// if the walk ever becomes strand-aware. It costs one char compare against a
// memcmp that only runs when the base already matched.
//
// **THE FIXTURE.** `ont.6ma.chr20.bam` (jb2bench `shell/fetch_ont_6ma.sh`) is a
// 2 Mb slice of ONT's public chromatin-accessibility run for HG002: 8,166 MM
// reads, 72.8 Mbp, 21.81M MM deltas at 2,310 calls per read, and EVERY read is
// `A+a.;C+h?;C+m?`. Three groups, two of them on C. It is the only fixture in the
// corpus that can measure this at all — the other multi-group one,
// `HG002_WGS_fiberseq.MAGEL2.bam`, is `C+m;A+a;T-a`, three groups on three
// different bases, so the merge cannot fire and it prices the test and nothing
// else. Both are run below for that reason.
//
// THREE ARMS:
//   perGroup — what ships: one sequence walk and one positions array per group
//   merged   — same base + strand + delta text reuses the first group's array
//   control  — a second, separately-declared copy of `perGroup`
//
// TWO MEASUREMENTS, because the change pays in two phases and they are not the
// same size: `parse` times `getModPositions` alone, `pipeline` times it with the
// CIGAR walk and the emit the shipped path runs after it.
//
// WHAT IT SAYS, 2026-08-14, output identical in every row:
//
//   fixture                          mergeable/read   parse    pipeline  control
//   ont.6ma.chr20 (72.8 Mbp)              1.00        1.268x    1.222x   0.978/0.993
//   ont.6ma.chr20 --defeat                0.03        0.996x    1.033x   1.002/1.018
//   200x.longread.mod (43.7 Mbp)          0.00        1.041x    1.099x   1.036/1.057
//   fiberseq.MAGEL2 (0.55 Mbp)            0.00        0.985x    1.011x   0.992/1.011
//
// **1.27x on the parse, and free where it cannot fire.** The bottom three rows
// are all inside their own control's drift, including `--defeat`, where every
// read pays a full-width delta compare that then fails. So unlike the one-pass
// shape in `multiGroupParse.bench.ts` — which buys 1.13x on three groups and
// gives back 0.917x on one — this is not a trade and needs no branch on group
// count. The test is cheap because it is per GROUP, three times a read, against
// a walk that is per BASE, 72.8 million times.
//
// **THE CIGAR HALF IS NOT WHERE THE MONEY IS, AND THE TODO ENTRY THIS CAME FROM
// IMPLIED IT WAS.** Subtracting the two columns on the top row puts walk+emit at
// 446.0 ms per group against 412.3 ms merged — **1.08x**, where the parse is
// 1.27x. "The existing identity grouping picks up the CIGAR walk for free" is
// true about the CODE (not a line of this bench's emit is arm-specific) and
// misleading about the VALUE. The reason is the one `cigarOpDensity.bench.ts`
// already established: that phase is bound by per-CALL work, and merging two
// groups halves the callbacks while doubling what each one does — the same byte
// lookups and compares happen either way. Only the traversal is saved.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { BamFile } from '@gmod/bam'
import { isSingleModType, parseModHeader } from '@jbrowse/modifications-utils'

import type { BamRecord } from '@gmod/bam'

const arg = (name: string, dflt: string) =>
  process.argv
    .find(a => a.startsWith(`--${name}=`))
    ?.slice(`--${name}=`.length) ?? dflt

const ROUNDS = Number(arg('rounds', '40'))
const BAM = arg('bam', join(process.env.HOME!, 'src/jb2bench/data'))
const FILE = arg('file', 'ont.6ma.chr20.bam')
const REFNAME = arg('refName', 'chr20')
const START = Number(arg('start', '1'))
const END = Number(arg('end', '100000000'))
// Price the test when it FAILS at full width. Every fixture in the corpus
// rejects a same-base compare on the base character or not at all, so nothing
// here measures two groups that share a base and differ in their deltas — the
// case that pays for the memcmp and gets nothing. `--defeat` perturbs the LAST
// delta of each read's last group, which is the worst shape available: the
// compare matches to the final byte before failing.
const DEFEAT = process.argv.includes('--defeat')

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
  positions: number[]
  probStart: number
  probStride: number
}

interface Entry {
  readIndex: number
  position: number
  base: string
  modType: string
  prob: number
}

// ---------------------------------------------------------------------------
// ARM 1: perGroup — what ships.

function modPositionsPerGroup(mm: string, fseq: string, fstrand: number) {
  const seqLength = fseq.length
  const isRev = fstrand === -1
  const groups = mm.split(';')
  const result: Mod[] = []
  let mlBase = 0

  for (const group of groups) {
    if (group === '') {
      continue
    }
    const split = group.split(',')
    const { base, typestr } = parseModHeader(split[0]!, group)
    const isSingleType = isSingleModType(typestr)
    const nTypes = isSingleType ? 1 : typestr.length
    const splitLength = split.length
    const nPositions = splitLength - 1

    const baseCode = base.charCodeAt(0)
    const targetCode = isRev
      ? (COMPLEMENT_CODE[baseCode] ?? baseCode)
      : baseCode
    const isN = base === 'N'
    const positions: number[] = isRev ? new Array(nPositions) : []
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
        positions,
        probStart: mlBase,
        probStride: 1,
      })
    } else {
      for (let j = 0, len = typestr.length; j < len; j++) {
        result.push({
          type: typestr[j]!,
          base,
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

// ---------------------------------------------------------------------------
// ARM 2: merged — a group whose base, strand and delta text repeat an earlier
// group's reuses that group's positions array instead of walking for it.

function modPositionsMerged(mm: string, fseq: string, fstrand: number) {
  const seqLength = fseq.length
  const isRev = fstrand === -1
  const groups = mm.split(';')
  const result: Mod[] = []
  let mlBase = 0

  // Groups already walked, for the reuse test. Parallel arrays rather than a
  // Map: a read carries one to four groups, so a linear scan of char compares
  // beats hashing a multi-kilobyte delta string. Allocated on the first walk,
  // so a single-group read never builds them.
  let seenKeys: string[] | undefined
  let seenDeltas: string[] | undefined
  let seenPositions: number[][] | undefined

  for (const group of groups) {
    if (group === '') {
      continue
    }
    const split = group.split(',')
    const basemod = split[0]!
    const { base, strand, typestr } = parseModHeader(basemod, group)
    const isSingleType = isSingleModType(typestr)
    const nTypes = isSingleType ? 1 : typestr.length
    const splitLength = split.length
    const nPositions = splitLength - 1

    // Everything after the header — `,2,2,1`. V8 slices a long string in O(1),
    // and the compare below rejects on length before it ever reads bytes.
    const deltas = group.slice(basemod.length)
    const key = base + strand

    let positions: number[] | undefined
    if (seenKeys !== undefined) {
      for (let s = 0, n = seenKeys.length; s < n; s++) {
        if (seenKeys[s] === key && seenDeltas![s] === deltas) {
          positions = seenPositions![s]
          break
        }
      }
    }

    if (positions === undefined) {
      const baseCode = base.charCodeAt(0)
      const targetCode = isRev
        ? (COMPLEMENT_CODE[baseCode] ?? baseCode)
        : baseCode
      const isN = base === 'N'
      positions = isRev ? new Array<number>(nPositions) : []
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

      if (seenKeys === undefined) {
        seenKeys = [key]
        seenDeltas = [deltas]
        seenPositions = [positions]
      } else {
        seenKeys.push(key)
        seenDeltas!.push(deltas)
        seenPositions!.push(positions)
      }
    }

    if (isSingleType) {
      result.push({
        type: typestr,
        base,
        positions,
        probStart: mlBase,
        probStride: 1,
      })
    } else {
      for (let j = 0, len = typestr.length; j < len; j++) {
        result.push({
          type: typestr[j]!,
          base,
          positions,
          probStart: mlBase + j,
          probStride: nTypes,
        })
      }
    }
    // Unchanged by the merge: the ML values of two separate groups are
    // consecutive, not interleaved, so each group still consumes its own
    // nPositions * nTypes whether or not it walked for them.
    mlBase += nPositions * nTypes
  }
  return result
}

// ---------------------------------------------------------------------------
// ARM 3: control — a second, separately-declared copy of ARM 1.

function modPositionsControl(mm: string, fseq: string, fstrand: number) {
  const seqLength = fseq.length
  const isRev = fstrand === -1
  const groups = mm.split(';')
  const result: Mod[] = []
  let mlBase = 0

  for (const group of groups) {
    if (group === '') {
      continue
    }
    const split = group.split(',')
    const { base, typestr } = parseModHeader(split[0]!, group)
    const isSingleType = isSingleModType(typestr)
    const nTypes = isSingleType ? 1 : typestr.length
    const splitLength = split.length
    const nPositions = splitLength - 1

    const baseCode = base.charCodeAt(0)
    const targetCode = isRev
      ? (COMPLEMENT_CODE[baseCode] ?? baseCode)
      : baseCode
    const isN = base === 'N'
    const positions: number[] = isRev ? new Array(nPositions) : []
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
        positions,
        probStart: mlBase,
        probStride: 1,
      })
    } else {
      for (let j = 0, len = typestr.length; j < len; j++) {
        result.push({
          type: typestr[j]!,
          base,
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

// ---------------------------------------------------------------------------
// The walk and emit, shared. The emit groups entries by positions IDENTITY, so
// it is also where the merged arm collects its second win — one CIGAR walk for
// the two C groups instead of two — without a line of it being arm-specific.

function walk(
  cigarOps: ArrayLike<number>,
  positions: number[],
  callback: (ref: number, idx: number) => void,
) {
  const l2 = positions.length
  if (l2 === 0) {
    return
  }
  let readPos = 0
  let refPos = 0
  let currPos = 0
  for (let i = 0, l = cigarOps.length; i < l && currPos < l2; i++) {
    const packed = cigarOps[i]!
    const len = packed >>> 4
    const op = packed & 0xf
    if (op === 4 || op === 1) {
      const readEnd = readPos + len
      while (currPos < l2 && positions[currPos]! < readEnd) {
        currPos++
      }
      readPos = readEnd
    } else if (op === 2 || op === 3) {
      refPos += len
    } else if (op === 0 || op === 8 || op === 7) {
      const readEnd = readPos + len
      const delta = refPos - readPos
      while (currPos < l2 && positions[currPos]! < readEnd) {
        callback(positions[currPos]! + delta, currPos)
        currPos++
      }
      readPos = readEnd
      refPos += len
    }
  }
}

function emit(r: Read, mods: Mod[], entries: Entry[]) {
  const isRev = r.strand === -1
  const ml = r.ml
  const nMods = mods.length
  if (nMods === 0) {
    return
  }
  let span = 0
  for (let i = 0, l = r.ops.length; i < l; i++) {
    const packed = r.ops[i]!
    const op = packed & 0xf
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
    let end = m + 1
    while (end < nMods && mods[end]!.positions === positions) {
      end++
    }
    const posLen = positions.length
    const groupStart = m
    const groupEnd = end
    walk(r.ops, positions, (ref, idx) => {
      const mmOrder = isRev ? posLen - 1 - idx : idx
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
    m = end
  }
  if (firstRef < 0) {
    return
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
      prob,
    })
  }
}

type Parse = (mm: string, fseq: string, fstrand: number) => Mod[]

function runParse(reads: Read[], parse: Parse) {
  let sink = 0
  for (const r of reads) {
    const mods = parse(r.mm, r.seq, r.strand)
    for (const m of mods) {
      sink += m.positions.length
    }
  }
  return sink
}

function runPipeline(reads: Read[], parse: Parse) {
  const entries: Entry[] = []
  for (const r of reads) {
    emit(r, parse(r.mm, r.seq, r.strand), entries)
  }
  return entries
}

// ---------------------------------------------------------------------------

function serialize(out: Entry[]) {
  const lines: string[] = []
  for (const e of out) {
    lines.push(
      `${e.readIndex} ${e.position} ${e.modType} ${e.base} ${e.prob.toFixed(6)}`,
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

// How many of a read's groups the merge can actually drop — reported so a 1.00x
// is never mistaken for "the merge does not pay" when it is really "this file
// has nothing to merge".
function mergeableGroups(mm: string) {
  const seen: string[] = []
  let groups = 0
  let saved = 0
  for (const group of mm.split(';')) {
    if (group === '') {
      continue
    }
    groups++
    const basemod = group.split(',')[0]!
    const { base, strand } = parseModHeader(basemod, group)
    const k = base + strand + group.slice(basemod.length)
    if (seen.includes(k)) {
      saved++
    } else {
      seen.push(k)
    }
  }
  return { groups, saved }
}

async function main() {
  if (!globalThis.gc) {
    console.error('run with --expose-gc\n')
  }
  const path = join(BAM, FILE)
  try {
    readFileSync(path, { flag: 'r' })
  } catch {
    console.log(`not present at ${path}, nothing to measure`)
    return
  }
  const bam = new BamFile({ bamPath: path, baiPath: `${path}.bai` })
  await bam.getHeader()
  const records = await bam.getRecordsForRange(REFNAME, START, END)
  let reads = toReads(records)
  if (DEFEAT) {
    // Bump the final delta of the last group by one. The ML array is unchanged
    // and one call moves, which is fine — every arm sees the same tag, and what
    // is being priced is the compare, not the output.
    reads = reads.map(r => {
      const groups = r.mm.split(';')
      let last = groups.length - 1
      while (last >= 0 && groups[last] === '') {
        last--
      }
      if (last < 0) {
        return r
      }
      const split = groups[last]!.split(',')
      if (split.length < 2) {
        return r
      }
      split[split.length - 1] = String(+split[split.length - 1]! + 1)
      groups[last] = split.join(',')
      return { ...r, mm: groups.join(';') }
    })
  }
  if (reads.length === 0) {
    console.log('no MM/ML reads in range')
    return
  }

  let bases = 0
  let groups = 0
  let saved = 0
  for (const r of reads) {
    bases += r.seq.length
    const m = mergeableGroups(r.mm)
    groups += m.groups
    saved += m.saved
  }
  const meanGroups = groups / reads.length
  const meanSaved = saved / reads.length

  const outPerGroup = serialize(runPipeline(reads, modPositionsPerGroup))
  const outMerged = serialize(runPipeline(reads, modPositionsMerged))
  const outControl = serialize(runPipeline(reads, modPositionsControl))

  const diffMerged = firstDifference(outPerGroup, outMerged)
  const diffControl = firstDifference(outPerGroup, outControl)
  if (diffControl) {
    throw new Error(
      `the control disagrees with the baseline it was copied from (${diffControl}) — the harness is broken`,
    )
  }

  const best = {
    parsePer: Infinity,
    parseMrg: Infinity,
    parseCtl: Infinity,
    pipePer: Infinity,
    pipeMrg: Infinity,
    pipeCtl: Infinity,
  }
  const sides = [
    {
      k: 'parsePer' as const,
      run: () => runParse(reads, modPositionsPerGroup),
    },
    { k: 'parseMrg' as const, run: () => runParse(reads, modPositionsMerged) },
    { k: 'parseCtl' as const, run: () => runParse(reads, modPositionsControl) },
    {
      k: 'pipePer' as const,
      run: () => runPipeline(reads, modPositionsPerGroup),
    },
    {
      k: 'pipeMrg' as const,
      run: () => runPipeline(reads, modPositionsMerged),
    },
    {
      k: 'pipeCtl' as const,
      run: () => runPipeline(reads, modPositionsControl),
    },
  ]
  for (let round = 0; round < ROUNDS; round++) {
    for (let i = 0; i < sides.length; i++) {
      const side = sides[(round + i) % sides.length]!
      best[side.k] = Math.min(best[side.k], time(side.run))
    }
  }

  const xp = (v: number) => `${(best.parsePer / v).toFixed(3)}x`
  const xl = (v: number) => `${(best.pipePer / v).toFixed(3)}x`
  console.log(
    `same-base MM groups: one positions array between them, or one each\n` +
      `${FILE} ${REFNAME}:${START}-${END}, min of ${ROUNDS} rotated rounds\n` +
      `  ${reads.length} MM reads, ${(bases / 1e6).toFixed(2)} Mbp, ` +
      `${meanGroups.toFixed(2)} MM groups/read, ${outPerGroup.length} marks emitted\n` +
      `  ${meanSaved.toFixed(2)} of those groups/read repeat an earlier group's base+deltas ` +
      `-> ${meanSaved === 0 ? 'NOTHING TO MERGE, this run prices the test only' : `${((meanSaved / meanGroups) * 100).toFixed(0)}% of the walks are redundant`}\n\n` +
      `  parse only\n` +
      `    per group   ${best.parsePer.toFixed(2).padStart(8)} ms   <- ships\n` +
      `    merged      ${best.parseMrg.toFixed(2).padStart(8)} ms   ${xp(best.parseMrg)}\n` +
      `    control     ${best.parseCtl.toFixed(2).padStart(8)} ms   ${xp(best.parseCtl)}   <- noise floor\n\n` +
      `  parse + CIGAR walk + emit\n` +
      `    per group   ${best.pipePer.toFixed(2).padStart(8)} ms   <- ships\n` +
      `    merged      ${best.pipeMrg.toFixed(2).padStart(8)} ms   ${xl(best.pipeMrg)}   ` +
      `output ${diffMerged ? `DIFFERS — ${diffMerged}` : 'identical'}\n` +
      `    control     ${best.pipeCtl.toFixed(2).padStart(8)} ms   ${xl(best.pipeCtl)}   <- noise floor\n`,
  )
}

await main()
