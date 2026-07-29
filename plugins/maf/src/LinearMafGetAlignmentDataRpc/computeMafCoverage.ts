import { DASH, LOWER_BIT, SPACE } from '../util/asciiBytes.ts'

import type { MafBlock } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { InsertionEntry } from '@jbrowse/alignments-core'

const N_UPPER = 78 // 'N'

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
 * `refRowIndex` is the display row of the reference assembly (resolved from
 * `region.assemblyName`), excluded from the identity numerator/denominator so
 * its trivial self-match doesn't inflate conservation. `-1` (no reference row
 * in the visible set) leaves identity over all rows.
 */
export function computeMafCoverage(
  blocks: MafBlock[],
  regionStart: number,
  regionEnd: number,
  refRowIndex = -1,
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
  const pendingInsLen = new Map<number, number>()

  const flushPending = (position: number) => {
    // Clamp to the region like depths/mismatches: a block overhanging the left
    // edge can close an insertion run at a refPos before `regionStart`, which
    // the interbase consumer would index at a negative offset. Pending state is
    // cleared regardless so it never leaks into the next closing column.
    const idx = position - regionStart
    if (idx >= 0 && idx < length) {
      for (const [, len] of pendingInsLen) {
        insertions.push({ position, length: len })
      }
    }
    pendingInsLen.clear()
  }

  for (const block of blocks) {
    const refBytes = block.refSeqBytes
    const refLen = refBytes.length
    let refPos = block.startBp
    for (let col = 0; col < refLen; col++) {
      const refByte = refBytes[col]!
      if (refByte === DASH) {
        for (const row of block.rows) {
          const sampleByte = row.alignmentBytes[col]!
          if (sampleByte !== DASH && sampleByte !== SPACE) {
            pendingInsLen.set(
              row.rowIndex,
              (pendingInsLen.get(row.rowIndex) ?? 0) + 1,
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
            const sampleByte = row.alignmentBytes[col]!
            if (sampleByte !== DASH && sampleByte !== SPACE) {
              depths[depthIdx]! += 1
              const sampleUpper = sampleByte & ~LOWER_BIT
              // A known ref base + any differing sample base (incl. N and IUPAC
              // codes, which render grey downstream) is a mismatch. An N ref is
              // unclassifiable, so nothing is recorded against it.
              if (refKnown && sampleUpper !== refUpper) {
                mismatches.push(refPos, sampleUpper)
              }
              // Identity counts non-reference species at a known ref column.
              if (refKnown && row.rowIndex !== refRowIndex) {
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
