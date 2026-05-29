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
}

/**
 * Per-position MAF coverage: at each ref bp, counts how many sample rows
 * have a non-gap base, and records mismatches between sample bases and the
 * reference. Reference-relative insertion columns (ref char `-`) are skipped
 * — they don't consume a ref position so they can't appear in the per-ref-bp
 * depth array. Bases are normalized to uppercase ASCII for comparison; `N`
 * on either side never counts as a mismatch.
 */
export function computeMafCoverage(
  blocks: MafBlock[],
  regionStart: number,
  regionEnd: number,
): MafCoverageResult {
  const length = Math.max(0, regionEnd - regionStart)
  const depths = new Float32Array(length)
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
          for (const row of block.rows) {
            const sampleByte = row.alignmentBytes[col]!
            if (sampleByte !== DASH && sampleByte !== SPACE) {
              depths[depthIdx]! += 1
              const sampleUpper = sampleByte & ~LOWER_BIT
              if (
                sampleUpper !== refUpper &&
                sampleUpper !== N_UPPER &&
                refUpper !== N_UPPER
              ) {
                mismatches.push({
                  position: refPos,
                  base: sampleUpper,
                  strand: 1,
                })
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
  for (let i = 0; i < length; i++) {
    const d = depths[i]!
    if (d > maxDepth) {
      maxDepth = d
    }
  }
  return { depths, maxDepth, startPos: regionStart, mismatches, insertions }
}
