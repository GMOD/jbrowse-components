import { DASH, LOWER_BIT, SPACE } from '../util/asciiBytes.ts'

import type { MafBlock } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { InsertionEntry, MismatchEntry } from '@jbrowse/alignments-core'

const N_UPPER = 78 // 'N'

export interface MafCoverageResult {
  depths: Float32Array
  maxDepth: number
  startPos: number
  mismatches: MismatchEntry[]
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
  /**
   * Per-row identity numerator/denominator, indexed by `rowIndex` (length
   * `nRows`): matching vs classifiable non-gap bases for each species against
   * the reference, summed over this region. Shipped as raw counts (not ratios)
   * so the main thread can sum them across visible regions before dividing. The
   * reference row's own entry stays 0 (excluded) → its identity reads as
   * undefined rather than a trivial 100%.
   */
  matchesPerRow: Float32Array
  classifiablePerRow: Float32Array
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
 *
 * `nRows` sizes the per-row arrays (the display row count); when omitted it's
 * derived from the max `rowIndex` present (the test path).
 */
export function computeMafCoverage(
  blocks: MafBlock[],
  regionStart: number,
  regionEnd: number,
  refRowIndex = -1,
  nRows?: number,
): MafCoverageResult {
  const length = Math.max(0, regionEnd - regionStart)
  const depths = new Float32Array(length)
  // Identity numerator (matches) + denominator (classifiable, non-ref bases at
  // a known ref column). Kept separate from `depths` so coverage bars are
  // unchanged. identity[i] = matches[i] / classifiable[i], NaN when denom 0.
  const matches = new Float32Array(length)
  const classifiable = new Float32Array(length)
  let nRowsResolved = nRows ?? 0
  if (nRows === undefined) {
    for (const block of blocks) {
      for (const row of block.rows) {
        nRowsResolved = Math.max(nRowsResolved, row.rowIndex + 1)
      }
    }
  }
  // Per-row identity counts, indexed by rowIndex (see MafCoverageResult).
  const matchesPerRow = new Float32Array(nRowsResolved)
  const classifiablePerRow = new Float32Array(nRowsResolved)
  const mismatches: MismatchEntry[] = []
  const insertions: InsertionEntry[] = []
  // Per-row pending insertion length at the current refPos. Flushed into
  // `insertions` when a non-gap ref column closes the insertion run (or at
  // block end). Tracks the actual run length so multi-column insertions are
  // emitted as a single entry, not N entries of length 1.
  const pendingInsLen = new Map<number, number>()

  const flushPending = (position: number) => {
    for (const [, len] of pendingInsLen) {
      insertions.push({ position, length: len })
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
                mismatches.push({
                  position: refPos,
                  base: sampleUpper,
                  strand: 1,
                })
              }
              // Identity counts non-reference species at a known ref column,
              // both in aggregate (per position) and per row.
              if (refKnown && row.rowIndex !== refRowIndex) {
                classifiable[depthIdx]! += 1
                const isMatch = sampleUpper === refUpper
                if (isMatch) {
                  matches[depthIdx]! += 1
                }
                if (row.rowIndex < nRowsResolved) {
                  classifiablePerRow[row.rowIndex]! += 1
                  if (isMatch) {
                    matchesPerRow[row.rowIndex]! += 1
                  }
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
    mismatches,
    insertions,
    identity,
    matchesPerRow,
    classifiablePerRow,
  }
}
