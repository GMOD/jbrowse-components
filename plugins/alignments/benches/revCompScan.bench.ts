// Reverse reads step one base at a time. Can one revcomp pass buy them `indexOf`?
//
//   node --expose-gc plugins/alignments/benches/revCompScan.bench.ts
//   node --expose-gc plugins/alignments/benches/revCompScan.bench.ts \
//     --file=200x.longread.mod.bam --refName=chr22_mask --start=1 --end=400000
//
// Flags: --rounds=<n> (default 20), --bam=<dir>, --file, --refName, --start,
// --end, --strand=rev|fwd|both (default rev)
//
// The harness rules are in agent-docs/reference/BENCHMARKING.md.
//
// THE QUESTION. `getModPositions` finds each FORWARD call with a
// single-character `indexOf` and that is 1.247x-1.560x on the parse phase, but
// reverse reads still step: `lastIndexOf` measured **0.786x**, slower than
// stepping (`mmDeltaJump.bench.ts`). That asymmetry is a V8 artifact — scanning
// backwards for a byte is not intrinsically harder — so half the reads are paying
// for a missing builtin rather than for real work.
//
// This prices the way around it that needs no WebAssembly: complement-and-reverse
// the read ONCE, then scan that forward with the fast builtin. A hit at index `v`
// in the reversed copy is read index `seqLength - 1 - v`, and the shipped walk's
// `seqLength - currPos` arithmetic is already exactly that, so the mapping is a
// rename rather than a transform.
//
// **The trade is one O(n) pass per read against every search in it.** So the
// number that decides this is not the read length, it is calls-per-read — the
// build is amortized over every group of the read that scans backwards, and both
// distinct groups of a dorado tag do.
//
// SIX ARMS, all carrying the same-base merge because it ships:
//   step      — what ships for reverse: charCodeAt one base at a time
//   revStr    — revcomp into a STRING once per read, then String.indexOf
//   revBuf    — revcomp into a Uint8Array once per read, then TypedArray.indexOf
//   hits      — no reversed copy: collect every occurrence with forward indexOf
//               into a fresh array, then index it from the end
//   hitsArena — the same, into a buffer allocated once and reused forever
//   backward  — htslib's shape: count, convert to indices from the start, one
//               forward scan. Allocates nothing at all
//   control   — a second, separately-declared copy of `step`
//
// Parse phase only, and reverse reads only by default: the forward half is
// identical in every arm and would only dilute the ratio.
//
// WHAT IT SAYS, 2026-08-14, positions identical in every row:
//
//   arm         ont.6ma.chr20 (2676 calls/read)   200x.longread.mod (947/read)
//   step               1.000x  <- ships                  1.000x  <- ships
//   revStr             1.022x                            0.793x
//   revBuf             0.633x                            0.480x
//   hits               1.214x                            1.464x
//   hitsArena          1.366x                            1.758x
//   backward           0.945x                            0.962x
//   control            1.001x                            0.996x
//
// **REVERSING THE READ IS THE IDEA THAT DOES NOT WORK, AND IT IS THE OBVIOUS
// ONE.** Both revcomp arms lose, because building the reversed copy is an O(n)
// JS pass and the stepping walk it replaces is also O(n) — so it starts a whole
// pass behind and has to win that back from searches alone. On the sparse fixture
// there is only one group to amortize it over and it never does.
//
// `revBuf` is worse still: `TypedArray.indexOf` is a generic element search and
// gets none of `String.indexOf`'s treatment. Whatever makes the string builtin
// fast, it is not something a byte array inherits.
//
// **WHAT WORKS IS NOT REVERSING ANYTHING.** `hits` scans FORWARD — the direction
// that has a fast builtin — collects the occurrence list, and then reads it back
// to front, because "the Nth match counting from the end" is just an index once
// you hold the list. One native scan replaces one JS pass, and the answer comes
// out of an array lookup.
//
// **AND THE ARENA IS FASTER THAN THE ARRAY, WHICH IS THE POINT WORTH KEEPING.**
// `hitsArena` is `hits` with the occurrence list in one buffer reused for every
// read instead of a fresh array per group, and it is 1.37x/1.76x against
// 1.21x/1.46x. The transient array was not just memory, it was the slower half:
// growing a `number[]` to ~12,300 entries per read costs more than the scan that
// fills it. So the version that allocates less is also the version that wins, and
// no trade has to be made between the two.
//
// **`backward` allocates nothing at all and still loses**, which is the reason
// the arena is the answer rather than htslib's shape. It needs the total count
// before it can convert an index-from-the-end into an index-from-the-start, and
// counting is itself a full scan — so it pays two where `hits` pays one. Correct,
// elegant, and 0.95x.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { BamFile } from '@gmod/bam'
import {
  getModPositions,
  isSingleModType,
  parseModHeader,
} from '@jbrowse/modifications-utils'

import type { BamRecord } from '@gmod/bam'

const arg = (name: string, dflt: string) =>
  process.argv
    .find(a => a.startsWith(`--${name}=`))
    ?.slice(`--${name}=`.length) ?? dflt

const ROUNDS = Number(arg('rounds', '20'))
const BAM = arg('bam', join(process.env.HOME!, 'src/jb2bench/data'))
const FILE = arg('file', 'ont.6ma.chr20.bam')
const REFNAME = arg('refName', 'chr20')
const START = Number(arg('start', '1'))
const END = Number(arg('end', '100000000'))
const STRAND = arg('strand', 'rev')

const COMPLEMENT_CODE: Record<number, number> = {
  65: 84,
  84: 65,
  67: 71,
  71: 67,
  78: 78,
}

// Identity outside ACGTN, which is what `COMPLEMENT_CODE[c] ?? c` does on the
// search target — complementing the SEQUENCE instead is equivalent because that
// mapping is its own inverse on every character it touches.
const COMPLEMENT_TABLE = new Uint8Array(256)
for (let i = 0; i < 256; i++) {
  COMPLEMENT_TABLE[i] = COMPLEMENT_CODE[i] ?? i
}

const latin1 = new TextDecoder('latin1')

interface Read {
  index: number
  strand: -1 | 0 | 1
  seq: string
  mm: string
}

interface Mod {
  type: string
  base: string
  positions: number[]
  probStart: number
  probStride: number
}

function revCompString(fseq: string) {
  const n = fseq.length
  const buf = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    buf[i] = COMPLEMENT_TABLE[fseq.charCodeAt(n - 1 - i)]!
  }
  return latin1.decode(buf)
}

function revCompBuffer(fseq: string) {
  const n = fseq.length
  const buf = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    buf[i] = COMPLEMENT_TABLE[fseq.charCodeAt(n - 1 - i)]!
  }
  return buf
}

// ---------------------------------------------------------------------------
// ARM 1: step — what ships for reverse.

function modPositionsStep(mm: string, fseq: string, fstrand: number) {
  const seqLength = fseq.length
  const isRev = fstrand === -1
  const result: Mod[] = []
  let mlBase = 0
  let seenKeys: string[] | undefined
  let seenDeltas: string[] | undefined
  let seenPositions: number[][] | undefined

  for (const group of mm.split(';')) {
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
      const isN = base === 'N'
      const endClamp = isRev ? 0 : Math.max(0, seqLength - 1)
      positions = isRev ? new Array<number>(nPositions) : []
      let writeIndex = isRev ? nPositions - 1 : 0
      let currPos = 0

      if (isRev) {
        const baseCode = base.charCodeAt(0)
        const targetCode = COMPLEMENT_CODE[baseCode] ?? baseCode
        for (let i = 1; i < splitLength; i++) {
          if (currPos >= seqLength) {
            positions[writeIndex--] = endClamp
            continue
          }
          let delta = +split[i]!
          do {
            if (
              isN ||
              fseq.charCodeAt(seqLength - 1 - currPos) === targetCode
            ) {
              delta--
            }
            currPos++
          } while (delta >= 0 && currPos < seqLength)
          positions[writeIndex--] = seqLength - currPos
        }
      } else {
        for (let i = 1; i < splitLength; i++) {
          const delta = +split[i]!
          let at = -1
          if (isN) {
            at = currPos + delta
            if (at >= seqLength) {
              at = -1
            }
          } else {
            for (let k = 0; k <= delta; k++) {
              at = fseq.indexOf(base, currPos)
              if (at < 0) {
                break
              }
              currPos = at + 1
            }
          }
          if (at < 0) {
            currPos = seqLength
            positions[writeIndex++] = endClamp
          } else {
            currPos = at + 1
            positions[writeIndex++] = at
          }
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
    mlBase += nPositions * nTypes
  }
  return result
}

// ---------------------------------------------------------------------------
// ARM 2: revStr — one revcomp string per read, then the forward builtin.

function modPositionsRevStr(mm: string, fseq: string, fstrand: number) {
  const seqLength = fseq.length
  const isRev = fstrand === -1
  const result: Mod[] = []
  let mlBase = 0
  let seenKeys: string[] | undefined
  let seenDeltas: string[] | undefined
  let seenPositions: number[][] | undefined
  // Built at most once per read, and shared by every group that scans backwards.
  let rev: string | undefined

  for (const group of mm.split(';')) {
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
      const isN = base === 'N'
      const endClamp = isRev ? 0 : Math.max(0, seqLength - 1)
      positions = isRev ? new Array<number>(nPositions) : []
      let writeIndex = isRev ? nPositions - 1 : 0
      let cursor = 0

      if (isRev) {
        if (rev === undefined) {
          rev = revCompString(fseq)
        }
        for (let i = 1; i < splitLength; i++) {
          const delta = +split[i]!
          let at = -1
          if (isN) {
            at = cursor + delta
            if (at >= seqLength) {
              at = -1
            }
          } else {
            for (let k = 0; k <= delta; k++) {
              at = rev.indexOf(base, cursor)
              if (at < 0) {
                break
              }
              cursor = at + 1
            }
          }
          if (at < 0) {
            cursor = seqLength
            positions[writeIndex--] = endClamp
          } else {
            cursor = at + 1
            positions[writeIndex--] = seqLength - 1 - at
          }
        }
      } else {
        for (let i = 1; i < splitLength; i++) {
          const delta = +split[i]!
          let at = -1
          if (isN) {
            at = cursor + delta
            if (at >= seqLength) {
              at = -1
            }
          } else {
            for (let k = 0; k <= delta; k++) {
              at = fseq.indexOf(base, cursor)
              if (at < 0) {
                break
              }
              cursor = at + 1
            }
          }
          if (at < 0) {
            cursor = seqLength
            positions[writeIndex++] = endClamp
          } else {
            cursor = at + 1
            positions[writeIndex++] = at
          }
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
    mlBase += nPositions * nTypes
  }
  return result
}

// ---------------------------------------------------------------------------
// ARM 3: revBuf — same, into a Uint8Array, searched with TypedArray.indexOf.

function modPositionsRevBuf(mm: string, fseq: string, fstrand: number) {
  const seqLength = fseq.length
  const isRev = fstrand === -1
  const result: Mod[] = []
  let mlBase = 0
  let seenKeys: string[] | undefined
  let seenDeltas: string[] | undefined
  let seenPositions: number[][] | undefined
  let rev: Uint8Array | undefined

  for (const group of mm.split(';')) {
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
      const isN = base === 'N'
      const endClamp = isRev ? 0 : Math.max(0, seqLength - 1)
      positions = isRev ? new Array<number>(nPositions) : []
      let writeIndex = isRev ? nPositions - 1 : 0
      let cursor = 0

      if (isRev) {
        if (rev === undefined) {
          rev = revCompBuffer(fseq)
        }
        const wanted = base.charCodeAt(0)
        for (let i = 1; i < splitLength; i++) {
          const delta = +split[i]!
          let at = -1
          if (isN) {
            at = cursor + delta
            if (at >= seqLength) {
              at = -1
            }
          } else {
            for (let k = 0; k <= delta; k++) {
              at = rev.indexOf(wanted, cursor)
              if (at < 0) {
                break
              }
              cursor = at + 1
            }
          }
          if (at < 0) {
            cursor = seqLength
            positions[writeIndex--] = endClamp
          } else {
            cursor = at + 1
            positions[writeIndex--] = seqLength - 1 - at
          }
        }
      } else {
        for (let i = 1; i < splitLength; i++) {
          const delta = +split[i]!
          let at = -1
          if (isN) {
            at = cursor + delta
            if (at >= seqLength) {
              at = -1
            }
          } else {
            for (let k = 0; k <= delta; k++) {
              at = fseq.indexOf(base, cursor)
              if (at < 0) {
                break
              }
              cursor = at + 1
            }
          }
          if (at < 0) {
            cursor = seqLength
            positions[writeIndex++] = endClamp
          } else {
            cursor = at + 1
            positions[writeIndex++] = at
          }
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
    mlBase += nPositions * nTypes
  }
  return result
}

// ---------------------------------------------------------------------------
// ARM 4: hits — no reversed copy at all. Collect every occurrence of the target
// base with repeated FORWARD `indexOf` (the fast builtin, scanning each stretch
// once), then index that array from its end, which is what "the Nth occurrence
// counting backwards" is once you have the list.
//
// The point is that it never materializes a second representation of the read.
// Both revcomp arms lose because building one costs a full O(n) JS pass, which
// is exactly what the stepping walk they replace costs — so they start a pass
// behind. This pays an array of roughly seqLength/4 numbers instead, filled by
// native scans.

function modPositionsHits(mm: string, fseq: string, fstrand: number) {
  const seqLength = fseq.length
  const isRev = fstrand === -1
  const result: Mod[] = []
  let mlBase = 0
  let seenKeys: string[] | undefined
  let seenDeltas: string[] | undefined
  let seenPositions: number[][] | undefined

  for (const group of mm.split(';')) {
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
      const isN = base === 'N'
      const endClamp = isRev ? 0 : Math.max(0, seqLength - 1)
      positions = isRev ? new Array<number>(nPositions) : []
      let writeIndex = isRev ? nPositions - 1 : 0

      if (isRev) {
        const baseCode = base.charCodeAt(0)
        const target = String.fromCharCode(
          COMPLEMENT_CODE[baseCode] ?? baseCode,
        )
        if (isN) {
          // Every base is a hit, so the list is the identity and the arithmetic
          // is the same as the forward N case mirrored.
          let hi = seqLength - 1
          for (let i = 1; i < splitLength; i++) {
            const at = hi - +split[i]!
            if (at < 0) {
              hi = -1
              positions[writeIndex--] = endClamp
            } else {
              hi = at - 1
              positions[writeIndex--] = at
            }
          }
        } else {
          const hits: number[] = []
          let p = fseq.indexOf(target, 0)
          while (p >= 0) {
            hits.push(p)
            p = fseq.indexOf(target, p + 1)
          }
          let hi = hits.length - 1
          for (let i = 1; i < splitLength; i++) {
            const idx = hi - +split[i]!
            if (idx < 0) {
              hi = -1
              positions[writeIndex--] = endClamp
            } else {
              hi = idx - 1
              positions[writeIndex--] = hits[idx]!
            }
          }
        }
      } else {
        let cursor = 0
        for (let i = 1; i < splitLength; i++) {
          const delta = +split[i]!
          let at = -1
          if (isN) {
            at = cursor + delta
            if (at >= seqLength) {
              at = -1
            }
          } else {
            for (let k = 0; k <= delta; k++) {
              at = fseq.indexOf(base, cursor)
              if (at < 0) {
                break
              }
              cursor = at + 1
            }
          }
          if (at < 0) {
            cursor = seqLength
            positions[writeIndex++] = endClamp
          } else {
            cursor = at + 1
            positions[writeIndex++] = at
          }
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
    mlBase += nPositions * nTypes
  }
  return result
}

// ---------------------------------------------------------------------------
// ARM 4b: hitsArena — `hits`, with the occurrence list in a buffer that is
// allocated once and reused for every read forever, instead of a fresh array per
// group. Same single native scan, same indexing, but the steady state allocates
// nothing: the objection to `hits` is the ~seqLength/4 transient numbers, not the
// scan that fills them.
//
// The buffer never escapes this function, and a worker is single-threaded, so
// the shared mutable state is contained. It converges on the longest read seen.

let arena = new Int32Array(4096)

function modPositionsHitsArena(mm: string, fseq: string, fstrand: number) {
  const seqLength = fseq.length
  const isRev = fstrand === -1
  const result: Mod[] = []
  let mlBase = 0
  let seenKeys: string[] | undefined
  let seenDeltas: string[] | undefined
  let seenPositions: number[][] | undefined

  if (isRev && arena.length < seqLength) {
    arena = new Int32Array(seqLength)
  }

  for (const group of mm.split(';')) {
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
      const isN = base === 'N'
      const endClamp = isRev ? 0 : Math.max(0, seqLength - 1)
      positions = isRev ? new Array<number>(nPositions) : []
      let writeIndex = isRev ? nPositions - 1 : 0

      if (isRev) {
        const baseCode = base.charCodeAt(0)
        const target = String.fromCharCode(
          COMPLEMENT_CODE[baseCode] ?? baseCode,
        )
        if (isN) {
          let hi = seqLength - 1
          for (let i = 1; i < splitLength; i++) {
            const at = hi - +split[i]!
            if (at < 0) {
              hi = -1
              positions[writeIndex--] = endClamp
            } else {
              hi = at - 1
              positions[writeIndex--] = at
            }
          }
        } else {
          const buf = arena
          let count = 0
          let p = fseq.indexOf(target, 0)
          while (p >= 0) {
            buf[count++] = p
            p = fseq.indexOf(target, p + 1)
          }
          let hi = count - 1
          for (let i = 1; i < splitLength; i++) {
            const idx = hi - +split[i]!
            if (idx < 0) {
              hi = -1
              positions[writeIndex--] = endClamp
            } else {
              hi = idx - 1
              positions[writeIndex--] = buf[idx]!
            }
          }
        }
      } else {
        let cursor = 0
        for (let i = 1; i < splitLength; i++) {
          const delta = +split[i]!
          let at = -1
          if (isN) {
            at = cursor + delta
            if (at >= seqLength) {
              at = -1
            }
          } else {
            for (let k = 0; k <= delta; k++) {
              at = fseq.indexOf(base, cursor)
              if (at < 0) {
                break
              }
              cursor = at + 1
            }
          }
          if (at < 0) {
            cursor = seqLength
            positions[writeIndex++] = endClamp
          } else {
            cursor = at + 1
            positions[writeIndex++] = at
          }
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
    mlBase += nPositions * nTypes
  }
  return result
}

// ---------------------------------------------------------------------------
// ARM 5: backward — htslib's answer, and the one that allocates nothing.
//
// `hits` wins by using the forward builtin, and pays an array of ~seqLength/4
// transient numbers to do it — on the sparse fixture that is 13x the size of the
// output it produces. This gets the forward builtin without the array: count the
// occurrences (a scan that stores nothing), convert each call's
// occurrence-index-from-the-end into an index-from-the-start, and resolve them
// with one forward scan. Those converted indices ASCEND, which is what makes a
// single forward pass enough.
//
// The conversion needs every call's cumulative offset before it can emit any of
// them, and the OUTPUT array is exactly that size — so it is used as its own
// scratch and overwritten in place. Two native scans, zero extra allocation.
// `agent-docs/reference/MODIFICATION_TAGS.md` records that `positions` is
// materialized on purpose because three consumers need random access to it;
// nothing beyond it needs to be.

function modPositionsBackward(mm: string, fseq: string, fstrand: number) {
  const seqLength = fseq.length
  const isRev = fstrand === -1
  const result: Mod[] = []
  let mlBase = 0
  let seenKeys: string[] | undefined
  let seenDeltas: string[] | undefined
  let seenPositions: number[][] | undefined

  for (const group of mm.split(';')) {
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
      const isN = base === 'N'
      const endClamp = isRev ? 0 : Math.max(0, seqLength - 1)
      positions = isRev ? new Array<number>(nPositions) : []

      if (isRev) {
        const baseCode = base.charCodeAt(0)
        const target = String.fromCharCode(
          COMPLEMENT_CODE[baseCode] ?? baseCode,
        )

        // How many the read has. 'N' matches every base, so it is the length.
        let total = 0
        if (isN) {
          total = seqLength
        } else {
          let p = fseq.indexOf(target, 0)
          while (p >= 0) {
            total++
            p = fseq.indexOf(target, p + 1)
          }
        }

        // Call k sits at occurrence (sum of deltas 0..k) + k, counting from the
        // END. Stash that in the slot the call's answer will occupy — the array
        // is filled back-to-front, so slot nPositions-1-k is call k.
        let run = 0
        for (let k = 0; k < nPositions; k++) {
          run += +split[k + 1]!
          positions[nPositions - 1 - k] = run + k
        }

        // Same thing counted from the START is total-1-that, and it ascends as
        // the slot index ascends, so one forward scan resolves them all.
        let seenOcc = 0
        let cursor = 0
        let at = -1
        for (let i = 0; i < nPositions; i++) {
          const f = total - 1 - positions[i]!
          if (f < 0) {
            positions[i] = endClamp
            continue
          }
          if (isN) {
            positions[i] = f
            continue
          }
          while (seenOcc <= f) {
            at = fseq.indexOf(target, cursor)
            if (at < 0) {
              break
            }
            cursor = at + 1
            seenOcc++
          }
          positions[i] = at
        }
      } else {
        let writeIndex = 0
        let cursor = 0
        for (let i = 1; i < splitLength; i++) {
          const delta = +split[i]!
          let at = -1
          if (isN) {
            at = cursor + delta
            if (at >= seqLength) {
              at = -1
            }
          } else {
            for (let k = 0; k <= delta; k++) {
              at = fseq.indexOf(base, cursor)
              if (at < 0) {
                break
              }
              cursor = at + 1
            }
          }
          if (at < 0) {
            cursor = seqLength
            positions[writeIndex++] = endClamp
          } else {
            cursor = at + 1
            positions[writeIndex++] = at
          }
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
    mlBase += nPositions * nTypes
  }
  return result
}

// ---------------------------------------------------------------------------
// ARM 6: control — a second, separately-declared copy of ARM 1.

function modPositionsControl(mm: string, fseq: string, fstrand: number) {
  const seqLength = fseq.length
  const isRev = fstrand === -1
  const result: Mod[] = []
  let mlBase = 0
  let seenKeys: string[] | undefined
  let seenDeltas: string[] | undefined
  let seenPositions: number[][] | undefined

  for (const group of mm.split(';')) {
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
      const isN = base === 'N'
      const endClamp = isRev ? 0 : Math.max(0, seqLength - 1)
      positions = isRev ? new Array<number>(nPositions) : []
      let writeIndex = isRev ? nPositions - 1 : 0
      let currPos = 0

      if (isRev) {
        const baseCode = base.charCodeAt(0)
        const targetCode = COMPLEMENT_CODE[baseCode] ?? baseCode
        for (let i = 1; i < splitLength; i++) {
          if (currPos >= seqLength) {
            positions[writeIndex--] = endClamp
            continue
          }
          let delta = +split[i]!
          do {
            if (
              isN ||
              fseq.charCodeAt(seqLength - 1 - currPos) === targetCode
            ) {
              delta--
            }
            currPos++
          } while (delta >= 0 && currPos < seqLength)
          positions[writeIndex--] = seqLength - currPos
        }
      } else {
        for (let i = 1; i < splitLength; i++) {
          const delta = +split[i]!
          let at = -1
          if (isN) {
            at = currPos + delta
            if (at >= seqLength) {
              at = -1
            }
          } else {
            for (let k = 0; k <= delta; k++) {
              at = fseq.indexOf(base, currPos)
              if (at < 0) {
                break
              }
              currPos = at + 1
            }
          }
          if (at < 0) {
            currPos = seqLength
            positions[writeIndex++] = endClamp
          } else {
            currPos = at + 1
            positions[writeIndex++] = at
          }
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
    mlBase += nPositions * nTypes
  }
  return result
}

// ---------------------------------------------------------------------------

type Parse = (mm: string, fseq: string, fstrand: number) => Mod[]

function runParse(reads: Read[], parse: Parse) {
  let sink = 0
  for (const r of reads) {
    for (const m of parse(r.mm, r.seq, r.strand)) {
      sink += m.positions.length
    }
  }
  return sink
}

function firstDifference(reads: Read[], a: Parse, b: Parse) {
  for (const r of reads) {
    const ma = a(r.mm, r.seq, r.strand)
    const mb = b(r.mm, r.seq, r.strand)
    if (ma.length !== mb.length) {
      return `read ${r.index}: ${ma.length} vs ${mb.length} groups`
    }
    for (let g = 0; g < ma.length; g++) {
      const pa = ma[g]!.positions
      const pb = mb[g]!.positions
      if (pa.length !== pb.length) {
        return `read ${r.index} group ${g}: ${pa.length} vs ${pb.length}`
      }
      for (let i = 0; i < pa.length; i++) {
        if (pa[i] !== pb[i]) {
          return (
            `read ${r.index} group ${g} (${ma[g]!.base}${ma[g]!.type}) ` +
            `position ${i}: ${pa[i]} vs ${pb[i]} [strand ${r.strand}]`
          )
        }
      }
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
    if (!mm) {
      continue
    }
    const strand = r.strand === -1 ? -1 : 1
    if (
      (STRAND === 'fwd' && strand !== 1) ||
      (STRAND === 'rev' && strand !== -1)
    ) {
      continue
    }
    reads.push({ index: i, strand, seq: r.seq, mm })
  }
  return reads
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
  const reads = toReads(records)
  if (reads.length === 0) {
    console.log('no MM reads in range for this strand')
    return
  }

  let bases = 0
  let calls = 0
  for (const r of reads) {
    bases += r.seq.length
    for (const group of r.mm.split(';')) {
      if (group !== '') {
        calls += group.split(',').length - 1
      }
    }
  }

  const diffCtl = firstDifference(reads, modPositionsStep, modPositionsControl)
  if (diffCtl) {
    throw new Error(`control disagrees with its baseline (${diffCtl})`)
  }
  const diffShipped = firstDifference(reads, modPositionsStep, (mm, s, f) =>
    getModPositions(mm, s, f),
  )
  if (diffShipped) {
    throw new Error(
      `getModPositions disagrees with this bench's baseline (${diffShipped})`,
    )
  }
  const diffStr = firstDifference(reads, modPositionsStep, modPositionsRevStr)
  const diffBuf = firstDifference(reads, modPositionsStep, modPositionsRevBuf)
  const diffHits = firstDifference(reads, modPositionsStep, modPositionsHits)
  const diffBack = firstDifference(
    reads,
    modPositionsStep,
    modPositionsBackward,
  )
  const diffArena = firstDifference(
    reads,
    modPositionsStep,
    modPositionsHitsArena,
  )

  const best = {
    step: Infinity,
    str: Infinity,
    buf: Infinity,
    hits: Infinity,
    arena: Infinity,
    back: Infinity,
    ctl: Infinity,
  }
  const sides = [
    { k: 'step' as const, run: () => runParse(reads, modPositionsStep) },
    { k: 'str' as const, run: () => runParse(reads, modPositionsRevStr) },
    { k: 'buf' as const, run: () => runParse(reads, modPositionsRevBuf) },
    { k: 'hits' as const, run: () => runParse(reads, modPositionsHits) },
    { k: 'arena' as const, run: () => runParse(reads, modPositionsHitsArena) },
    { k: 'back' as const, run: () => runParse(reads, modPositionsBackward) },
    { k: 'ctl' as const, run: () => runParse(reads, modPositionsControl) },
  ]
  for (let round = 0; round < ROUNDS; round++) {
    for (let i = 0; i < sides.length; i++) {
      const side = sides[(round + i) % sides.length]!
      best[side.k] = Math.min(best[side.k], time(side.run))
    }
  }
  const x = (v: number) => `${(best.step / v).toFixed(3)}x`
  console.log(
    `reverse delta walk: step, or one revcomp pass then indexOf\n` +
      `${FILE} ${REFNAME}:${START}-${END}, strand=${STRAND}, min of ${ROUNDS} rotated rounds\n` +
      `  ${reads.length} MM reads, ${(bases / 1e6).toFixed(2)} Mbp, ` +
      `${(calls / 1e6).toFixed(2)}M calls, ` +
      `${Math.round(bases / reads.length)} bp/read, ` +
      `${Math.round(calls / reads.length)} calls/read\n\n` +
      `  step        ${best.step.toFixed(2).padStart(8)} ms   <- ships\n` +
      `  revStr      ${best.str.toFixed(2).padStart(8)} ms   ${x(best.str)}   ` +
      `positions ${diffStr ? `DIFFER — ${diffStr}` : 'identical'}\n` +
      `  revBuf      ${best.buf.toFixed(2).padStart(8)} ms   ${x(best.buf)}   ` +
      `positions ${diffBuf ? `DIFFER — ${diffBuf}` : 'identical'}\n` +
      `  hits        ${best.hits.toFixed(2).padStart(8)} ms   ${x(best.hits)}   ` +
      `positions ${diffHits ? `DIFFER — ${diffHits}` : 'identical'}\n` +
      `  hitsArena   ${best.arena.toFixed(2).padStart(8)} ms   ${x(best.arena)}   ` +
      `positions ${diffArena ? `DIFFER — ${diffArena}` : 'identical'}\n` +
      `  backward    ${best.back.toFixed(2).padStart(8)} ms   ${x(best.back)}   ` +
      `positions ${diffBack ? `DIFFER — ${diffBack}` : 'identical'}\n` +
      `  control     ${best.ctl.toFixed(2).padStart(8)} ms   ${x(best.ctl)}   <- noise floor\n`,
  )
}

await main()
