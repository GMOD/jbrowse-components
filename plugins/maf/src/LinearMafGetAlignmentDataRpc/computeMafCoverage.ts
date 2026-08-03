import { DASH, LOWER_BIT, N_UPPER, SPACE } from '../util/asciiBytes.ts'

import type { MafWireBlock } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { InsertionEntry } from '@jbrowse/alignments-core'

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
 * The sample's aligned base at column `col`, uppercased — or undefined when the
 * column carries no base for this row: an alignment gap (`-`), missing data
 * (` `), or a column past the end of a row shorter than the reference.
 *
 * That last case is why this is a helper rather than the test spelled out at
 * each use. A typed array reads `undefined` out of range and `undefined` is
 * neither `DASH` nor `SPACE`, so both walks below used to count a phantom base
 * at every missing column of a truncated row — phantom insertion length,
 * phantom depth, and a mismatch recorded against base code 0. Every other
 * per-column row walk in the plugin stops at the row's end (`renderBases`,
 * `buildInstanceBuffer`, `IdentityColumns.accumulate`); one helper keeps the
 * three conditions together so a new caller can't drop one.
 */
function alignedBaseUpper(alignmentBytes: Uint8Array, col: number) {
  const byte = alignmentBytes[col]
  return byte === undefined || byte === DASH || byte === SPACE
    ? undefined
    : byte & ~LOWER_BIT
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
 */
export function computeMafCoverage(
  blocks: MafWireBlock[],
  regionStart: number,
  regionEnd: number,
  refSampleId?: string,
): MafCoverageResult {
  const length = Math.max(0, regionEnd - regionStart)
  const depths = new Float32Array(length)
  // Identity numerator (matches) + denominator (classifiable, non-ref bases at
  // a known ref column). Kept separate from `depths` so coverage bars are
  // unchanged. identity[i] = matches[i] / classifiable[i], NaN when denom 0.
  const matches = new Float32Array(length)
  const classifiable = new Float32Array(length)
  const mismatches = new MismatchWriter()
  const insertions: InsertionEntry[] = []
  // Per-row pending insertion length at the current refPos. Flushed into
  // `insertions` when a non-gap ref column closes the insertion run (or at
  // block end). Tracks the actual run length so multi-column insertions are
  // emitted as a single entry, not N entries of length 1.
  const pendingInsLen = new Map<string, number>()

  const flushPending = (position: number) => {
    // Called at every reference column, and insertions are rare, so the empty
    // case skips straight past the clamp and the clear.
    if (pendingInsLen.size > 0) {
      // Clamp to the region like depths/mismatches: a block overhanging the
      // left edge can close an insertion run at a refPos before `regionStart`,
      // which the interbase consumer would index at a negative offset. Pending
      // state is cleared regardless so it never leaks into the next closing
      // column.
      const idx = position - regionStart
      if (idx >= 0 && idx < length) {
        for (const [, len] of pendingInsLen) {
          insertions.push({ position, length: len })
        }
      }
      pendingInsLen.clear()
    }
  }

  for (const block of blocks) {
    const refBytes = block.refSeqBytes
    const refLen = refBytes.length
    let refPos = block.startBp
    for (let col = 0; col < refLen; col++) {
      const refByte = refBytes[col]!
      if (refByte === DASH) {
        for (const row of block.rows) {
          if (alignedBaseUpper(row.alignmentBytes, col) !== undefined) {
            pendingInsLen.set(
              row.sampleId,
              (pendingInsLen.get(row.sampleId) ?? 0) + 1,
            )
          }
        }
      } else {
        flushPending(refPos)
        const depthIdx = refPos - regionStart
        if (depthIdx >= 0 && depthIdx < length) {
          const refUpper = refByte & ~LOWER_BIT
          const refKnown = refUpper !== N_UPPER
          for (const row of block.rows) {
            const sampleUpper = alignedBaseUpper(row.alignmentBytes, col)
            if (sampleUpper !== undefined) {
              depths[depthIdx]! += 1
              // A known ref base + any differing sample base (incl. N and IUPAC
              // codes, which render grey downstream) is a mismatch. An N ref is
              // unclassifiable, so nothing is recorded against it.
              if (refKnown && sampleUpper !== refUpper) {
                mismatches.push(refPos, sampleUpper)
              }
              // Identity counts non-reference species at a known ref column.
              if (refKnown && row.sampleId !== refSampleId) {
                classifiable[depthIdx]! += 1
                if (sampleUpper === refUpper) {
                  matches[depthIdx]! += 1
                }
              }
            }
          }
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
    const d = depths[i]!
    if (d > maxDepth) {
      maxDepth = d
    }
    const denom = classifiable[i]!
    identity[i] = denom > 0 ? matches[i]! / denom : Number.NaN
  }
  return {
    depths,
    maxDepth,
    startPos: regionStart,
    ...mismatches.finish(),
    insertions,
    identity,
  }
}
