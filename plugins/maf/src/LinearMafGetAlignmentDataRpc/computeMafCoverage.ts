import { DASH, LOWER_BIT, N_UPPER, SPACE } from '../util/asciiBytes.ts'

import type { MafWireRegionData } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { InsertionEntry } from '@jbrowse/alignments-core'

/**
 * The columns of the wire that coverage actually reads. Named as a subset
 * rather than taking the whole `MafWireRegionData` because coverage runs
 * *before* `coverage` and `refSampleId` exist — it is what produces them — so
 * the full type would be unsatisfiable at the only call site.
 */
export type MafWireBlocksInput = Pick<
  MafWireRegionData,
  | 'arena'
  | 'rowOffset'
  | 'rowLength'
  | 'rowSample'
  | 'blockStartBp'
  | 'blockRefOffset'
  | 'blockRefLength'
  | 'blockRowStart'
  | 'sampleIds'
>

/**
 * Growable `(position, base)` pairs. Mismatches are the one per-base-per-row
 * output here — a wide region across many species produces hundreds of
 * thousands — and the only consumers (`computeSNPCoverage` and the tooltip
 * arrays shipped to the client) both want parallel typed arrays. Emitting
 * objects and repacking them, which is what this replaced, allocated one
 * short-lived object per mismatch purely to copy two numbers out of it.
 */
class MismatchWriter {
  private positions = new Uint32Array(1024)
  private bases = new Uint8Array(1024)
  count = 0

  push(position: number, base: number) {
    if (this.count === this.positions.length) {
      const nextPositions = new Uint32Array(this.count * 2)
      nextPositions.set(this.positions)
      this.positions = nextPositions
      const nextBases = new Uint8Array(this.count * 2)
      nextBases.set(this.bases)
      this.bases = nextBases
    }
    this.positions[this.count] = position
    this.bases[this.count] = base
    this.count++
  }

  // Right-sized copies, not subarray views: these are retained per region for
  // as long as the region is loaded, so a view would pin the doubling slack —
  // up to twice the live bytes — for the session.
  finish() {
    return {
      mismatchPositions: this.positions.slice(0, this.count),
      mismatchBases: this.bases.slice(0, this.count),
    }
  }
}

/**
 * `NO_BASE` rather than `undefined`, so this returns a plain integer on every
 * path. It is called once per cell — the plugin's hottest per-cell path outside
 * the renderer — and a `number | undefined` return makes every call site test a
 * union.
 *
 * 255 can't collide with a real answer: the result is always `byte & ~LOWER_BIT`
 * with bit 5 cleared, and 255 has it set.
 */
const NO_BASE = 255

/**
 * The sample's aligned base at column `col`, uppercased — or `NO_BASE` when the
 * column carries no base for this row: an alignment gap (`-`), missing data
 * (` `), or a column past the end of a row shorter than the reference.
 *
 * That last case is why this is a helper rather than the test spelled out at
 * each use. Both walks below used to count a phantom base at every missing
 * column of a truncated row — phantom insertion length, phantom depth, and a
 * mismatch recorded against base code 0. Every other per-column row walk in the
 * plugin stops at the row's end (`renderBases`, `buildInstanceBuffer`,
 * `IdentityColumns.accumulate`); one helper keeps the three conditions together
 * so a new caller can't drop one.
 *
 * The length check got *more* load-bearing when rows moved into the shared
 * arena: a row's bytes are now immediately followed by the next row's, so
 * reading past `len` no longer returns nothing — it returns another species'
 * base, which would score as real data. `len` is `rowLength[i]`, never the
 * arena's length.
 */
function alignedBaseUpper(
  arena: Uint8Array,
  base: number,
  len: number,
  col: number,
) {
  if (col >= len) {
    return NO_BASE
  }
  const byte = arena[base + col]!
  return byte === DASH || byte === SPACE ? NO_BASE : byte & ~LOWER_BIT
}

export interface MafCoverageResult {
  depths: Float32Array
  maxDepth: number
  startPos: number
  /** parallel arrays, one entry per mismatching sample base */
  mismatchPositions: Uint32Array
  mismatchBases: Uint8Array
  insertions: InsertionEntry[]
  /**
   * Per-ref-bp fraction of aligned non-reference species matching the reference
   * base (percent identity / conservation). `NaN` where no classifiable base
   * exists — depth 0, or the reference itself is `N`. Distinct from `depths`:
   * the reference row is excluded so a single divergent species reads 0%, not
   * 50%, and a sample `N`/IUPAC code counts against identity (same policy as
   * the SNP mismatches above).
   */
  identity: Float32Array
}

/**
 * Per-position MAF coverage: at each ref bp, counts how many sample rows
 * have a non-gap base, and records mismatches between sample bases and the
 * reference. Reference-relative insertion columns (ref char `-`) are skipped
 * — they don't consume a ref position so they can't appear in the per-ref-bp
 * depth array. Bases are normalized to uppercase ASCII for comparison. A
 * sample `N` (frequent in MAF) is a real mismatch against a known ref and is
 * recorded so it renders as a grey segment; columns where the *reference* is
 * `N` are unclassifiable and emit no mismatch.
 *
 * `refSampleId` is the reference assembly's own sample id (resolved from
 * `region.assemblyName`), excluded from the identity numerator/denominator so
 * its trivial self-match doesn't inflate conservation. Undefined (the
 * reference is not one of the rows) leaves identity over all rows.
 *
 * Reads the columnar wire directly, so the worker never materializes the row
 * objects it would then have to hand to `postMessage` — see
 * `MafWireRegionData`. Rows of block `b` are the index range
 * `blockRowStart[b] .. blockRowStart[b + 1]`, and a row's bases are the arena
 * slice at `rowOffset[i]`.
 *
 * The walk stays column-major, and that is not an accident of how it was first
 * written. It reads `arena[rowOffset[i] + col]` down the rows of a column, which
 * strides a row length per read, so transposing it to one sequential scan per
 * row looks like the obvious win — it isn't. A column-major sweep's working set
 * is one *block*, a few tens of KB, not the whole arena, and where a block does
 * exceed L2 the 26 concurrent sequential streams still prefetch. Measured
 * interleaved against a row-major version at block widths from 120 to 32,000
 * columns, the transpose came out between 0.92x and 1.06x — and it costs a
 * counting sort per block, because mismatches are a sequence whose order a test
 * and both consumers depend on, and row-major emits them grouped by row.
 *
 * What the column-major shape *is* good for is the accumulation: every row of a
 * column lands on the same three array slots, so depth and the two identity
 * counters are summed in locals and folded in once per column instead of once
 * per cell. That plus the `NO_BASE` sentinel is ~1.3x over the same data.
 *
 * The other idea worth heading off is SWAR — reading the arena as `Uint32` and
 * classifying four columns at a time. A kernel doing just the depth and match
 * counts measures 4.5x, which is what makes it tempting, but that number is
 * bought by testing "is this a base" as `folded >= 0x40`. That threshold quietly
 * reclassifies `.` and `*`, which today count as bases. Testing for `-` and ` `
 * exactly costs three lane-wise zero-byte tests per word where the threshold
 * costs one add, and the whole arithmetic advantage goes with it: a full
 * exact-semantics SWAR walk, output-identical to this one, measured 0.51x.
 */
export function computeMafCoverage(
  data: MafWireBlocksInput,
  regionStart: number,
  regionEnd: number,
  refSampleId?: string,
): MafCoverageResult {
  const {
    arena,
    rowOffset,
    rowLength,
    rowSample,
    blockStartBp,
    blockRefOffset,
    blockRefLength,
    blockRowStart,
    sampleIds,
  } = data
  const length = Math.max(0, regionEnd - regionStart)
  // All three accumulate integers — a row either has a base at this position or
  // it doesn't — so they count in `Uint32Array` and only `depths` converts to
  // the `Float32Array` the consumers want, once, at the end.
  const depthCounts = new Uint32Array(length)
  // Identity numerator (matches) + denominator (classifiable, non-ref bases at
  // a known ref column). Kept separate from `depths` so coverage bars are
  // unchanged. identity[i] = matches[i] / classifiable[i], NaN when denom 0.
  const matches = new Uint32Array(length)
  const classifiable = new Uint32Array(length)
  const mismatches = new MismatchWriter()
  const insertions: InsertionEntry[] = []
  // The reference as a sample *index*, so the per-row identity test below is an
  // integer compare rather than a string one. -1 when the reference names no
  // row, which is `indexOf`'s answer for both "not in this region" and "no
  // reference resolved" — the two cases that leave identity over all rows.
  const refSample =
    refSampleId === undefined ? -1 : sampleIds.indexOf(refSampleId)

  // Per-row pending insertion length at the current refPos, keyed by sample
  // index. Flushed into `insertions` when a non-gap ref column closes the
  // insertion run (or at block end). Tracks the actual run length so
  // multi-column insertions are emitted as a single entry, not N entries of
  // length 1.
  //
  // A dense column plus an explicit dirty list rather than a Map: this is
  // touched at every insertion column of every row, and the flush below runs at
  // every *reference* column, where the dirty count answers "is anything
  // pending" without a Map's iterator.
  const pendingInsLen = new Uint32Array(sampleIds.length)
  const pendingSamples = new Uint32Array(sampleIds.length)
  let pendingCount = 0

  const flushPending = (position: number) => {
    // Called at every reference column, and insertions are rare, so the empty
    // case skips straight past the clamp and the clear.
    if (pendingCount > 0) {
      // Clamp to the region like depths/mismatches: a block overhanging the
      // left edge can close an insertion run at a refPos before `regionStart`,
      // which the interbase consumer would index at a negative offset. Pending
      // state is cleared regardless so it never leaks into the next closing
      // column.
      const idx = position - regionStart
      const inRegion = idx >= 0 && idx < length
      for (let p = 0; p < pendingCount; p++) {
        const sample = pendingSamples[p]!
        if (inRegion) {
          insertions.push({ position, length: pendingInsLen[sample]! })
        }
        pendingInsLen[sample] = 0
      }
      pendingCount = 0
    }
  }

  for (let block = 0; block < blockStartBp.length; block++) {
    const refBase = blockRefOffset[block]!
    const refLen = blockRefLength[block]!
    const rowLo = blockRowStart[block]!
    const rowHi = blockRowStart[block + 1]!
    let refPos = blockStartBp[block]!
    for (let col = 0; col < refLen; col++) {
      const refByte = arena[refBase + col]!
      if (refByte === DASH) {
        for (let i = rowLo; i < rowHi; i++) {
          if (
            alignedBaseUpper(arena, rowOffset[i]!, rowLength[i]!, col) !==
            NO_BASE
          ) {
            const sample = rowSample[i]!
            if (pendingInsLen[sample] === 0) {
              pendingSamples[pendingCount++] = sample
            }
            pendingInsLen[sample]! += 1
          }
        }
      } else {
        flushPending(refPos)
        const depthIdx = refPos - regionStart
        if (depthIdx >= 0 && depthIdx < length) {
          const refUpper = refByte & ~LOWER_BIT
          const refKnown = refUpper !== N_UPPER
          // Counted in locals and folded in once below. Every row of this
          // column lands on the same three array slots, so accumulating them
          // there is a read-modify-write per *cell* where this is one per
          // column — the one thing the column-major shape is good for.
          let depth = 0
          let columnClassifiable = 0
          let columnMatches = 0
          for (let i = rowLo; i < rowHi; i++) {
            const sampleUpper = alignedBaseUpper(
              arena,
              rowOffset[i]!,
              rowLength[i]!,
              col,
            )
            if (sampleUpper !== NO_BASE) {
              depth++
              // A known ref base + any differing sample base (incl. N and IUPAC
              // codes, which render grey downstream) is a mismatch. An N ref is
              // unclassifiable, so nothing is recorded against it.
              if (refKnown && sampleUpper !== refUpper) {
                mismatches.push(refPos, sampleUpper)
              }
              // Identity counts non-reference species at a known ref column.
              if (refKnown && rowSample[i]! !== refSample) {
                columnClassifiable++
                if (sampleUpper === refUpper) {
                  columnMatches++
                }
              }
            }
          }
          // `+=`, not `=`: nothing here assumes two blocks can't quote the same
          // reference position.
          depthCounts[depthIdx]! += depth
          classifiable[depthIdx]! += columnClassifiable
          matches[depthIdx]! += columnMatches
        }
        refPos++
      }
    }
    // Trailing insertion at block end (ref ends with `-` columns).
    flushPending(refPos)
  }

  let maxDepth = 0
  const identity = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    const d = depthCounts[i]!
    if (d > maxDepth) {
      maxDepth = d
    }
    const denom = classifiable[i]!
    identity[i] = denom > 0 ? matches[i]! / denom : Number.NaN
  }
  return {
    depths: new Float32Array(depthCounts),
    maxDepth,
    startPos: regionStart,
    ...mismatches.finish(),
    insertions,
    identity,
  }
}
