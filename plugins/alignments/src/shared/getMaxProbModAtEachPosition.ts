import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_M,
  CIGAR_N,
  CIGAR_X,
  getNextRefPos,
} from '@jbrowse/cigar-utils'

import type { ModWithPositions } from '@jbrowse/modifications-utils'

/**
 * Walk one read's modification calls and hand the caller the single most likely
 * one at each reference position, in ascending position order.
 *
 * A position can carry several calls — a combined code like `C+mh` reports 5mC
 * and 5hmC at every cytosine — and only the winner is painted, so the walk has
 * to keep a running best per position before anything can be emitted.
 *
 * **The running best is a packed `Uint16Array`, and that is the whole point of
 * this function.** It used to be `{type, base, prob}` objects in a sparse array
 * indexed by reference offset, which is one object per called position per read
 * — hundreds of thousands of them in a 19 kb window of deep nanopore data, into
 * an array sparse enough for V8 to take into dictionary mode.
 * `plugins/alignments/benches/modExtract.bench.ts` prices the swap at **4.01x**
 * on `200x.longread.mod.bam` (781 -> 195 ms, control 0.994x).
 *
 * Two things make the packing lossless rather than a precision trade:
 *
 * - The probability is carried as its **raw ML byte**. Every value here is
 *   exactly `(N + 0.5) / 256` for a byte N, so the byte determines the
 *   probability and orders identically to it; the division happens once per
 *   emitted call instead of once per call examined.
 * - The type is carried as an **index into `modifications`**, so `type` and
 *   `base` are recovered from the mod the caller already has rather than
 *   stored. 0 means "nothing called here", so the index is offset by one —
 *   which is also why a read with more than 255 distinct modification codes
 *   would need a wider array, and there is no such read.
 *
 * **The CIGAR is walked once per positions ARRAY, not once per entry.** Entries
 * called at identical positions are handed one array by `getModPositions`, and
 * this function groups the ones that share it by identity — picking the winner
 * across the group inside the one walk instead of re-walking to the same offsets.
 * That covers the types of a combined code (`C+mh`), and since the same-base
 * merge it covers two separate groups on one base as well (dorado's
 * `C+h?;C+m?`). `plugins/alignments/benches/modCombinedCode.bench.ts` prices the
 * first at 2.07x on a `C+mh` read.
 *
 * Two entries whose positions merely happen to be EQUAL are not grouped, and
 * must not be: the grouping is an identity test precisely so that it can never
 * be wrong about whether the walks coincide. Deciding that two groups DO
 * coincide is `getModPositions`' job, one layer up, where the delta lists are
 * still in hand. **htslib splits the responsibility the same way** — a pointer
 * compare into the MM string, `state->MM[j] == MMptr` in `sam_mods.c` — so this
 * is the reference implementation's shape rather than a local trick
 * (`agent-docs/reference/MODIFICATION_TAGS.md`).
 *
 * **Groups on DIFFERENT canonical bases are still N walks over the same ops**,
 * and no parse-time merge can fold them: a Fiber-seq read's `C+m` and `A+a` have
 * genuinely different positions. Merging those ascending streams to walk once is
 * `agent-docs/ideas/walk-the-cigar-once-for-a-reads-whole-mm-tag-not-once-per-group.md`;
 * don't
 * mistake it for something this grouping already does. Expect ~1.1x from it —
 * `cigarOpDensity.bench.ts` and the same-base merge's split both say the walk
 * phase is bound by per-call work rather than by traversal.
 */
export function forEachMaxProbMod(
  modifications: readonly ModWithPositions[],
  /** raw ML bytes — `getModProbabilityBytes`, NOT `getModProbabilities` */
  mlBytes: ArrayLike<number> | undefined,
  ops: ArrayLike<number>,
  fstrand: -1 | 0 | 1,
  cb: (refPos: number, mod: ModWithPositions, prob: number) => void,
) {
  if (modifications.length === 0) {
    return
  }
  const isReverse = fstrand === -1
  // The read's reference span bounds every offset getNextRefPos can emit, so
  // one dense array covers the read with no bounds test in the hot loop.
  let span = 0
  for (let i = 0, l = ops.length; i < l; i++) {
    const packed = ops[i]!
    const op = packed & 0xf
    if (
      op === CIGAR_M ||
      op === CIGAR_D ||
      op === CIGAR_N ||
      op === CIGAR_EQ ||
      op === CIGAR_X
    ) {
      span += packed >>> 4
    }
  }
  const best = new Uint16Array(span + 1)
  // Track the touched range so the emit loop scans the called part of the read
  // rather than all of it — a 50 kb read with calls in one 2 kb stretch would
  // otherwise walk 48 kb of zeroes.
  let firstRef = -1
  let lastRef = -1

  const nMods = modifications.length
  for (let m = 0; m < nMods;) {
    const mod = modifications[m]!
    const positions = mod.positions
    const posLen = positions.length

    // `getModPositions` shares one positions array across the types of one MM
    // group and emits them consecutively, so a run of entries holding the same
    // array by identity is one group — and one walk. A combined code's second
    // type would otherwise re-walk the CIGAR to arrive at exactly the reference
    // offsets the first type just visited.
    let end = m + 1
    while (end < nMods && modifications[end]!.positions === positions) {
      end++
    }

    if (end - m === 1) {
      const { probStart, probStride } = mod
      const tag = (m + 1) << 8
      getNextRefPos(ops, positions, (ref, idx) => {
        const mmOrder = isReverse ? posLen - 1 - idx : idx
        const byte = mlBytes?.[probStart + mmOrder * probStride] ?? 0
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
      getNextRefPos(ops, positions, (ref, idx) => {
        const mmOrder = isReverse ? posLen - 1 - idx : idx
        // First maximum wins, which is how the per-entry walks resolved a tie
        // between two types of the same group: the later one needed a strictly
        // greater byte to displace the earlier.
        let bestByte = -1
        let bestIdx = groupStart
        for (let k = groupStart; k < groupEnd; k++) {
          const g = modifications[k]!
          const byte = mlBytes?.[g.probStart + mmOrder * g.probStride] ?? 0
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
    return
  }
  for (let ref = firstRef; ref <= lastRef; ref++) {
    const packed = best[ref]!
    if (packed === 0) {
      continue
    }
    cb(ref, modifications[(packed >>> 8) - 1]!, ((packed & 0xff) + 0.5) / 256)
  }
}
