import type { MafBlock } from '../LinearMafRenderer/mafBackendTypes.ts'
import type { InsertionEntry, MismatchEntry } from '@jbrowse/alignments-core'

const DASH = 45
const N_UPPER = 78

function toUpper(b: number) {
  return b >= 97 && b <= 122 ? b - 32 : b
}

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
  const insertionsSeen = new Map<number, Set<number>>()
  const insertions: InsertionEntry[] = []

  for (const block of blocks) {
    const refBytes = block.refSeqBytes
    const refLen = refBytes.length
    let refPos = block.startBp
    for (let col = 0; col < refLen; col++) {
      const refByte = refBytes[col]!
      if (refByte === DASH) {
        for (const row of block.rows) {
          const sampleByte = row.alignmentBytes[col]!
          if (sampleByte !== DASH) {
            let seen = insertionsSeen.get(row.rowIndex)
            if (!seen) {
              seen = new Set()
              insertionsSeen.set(row.rowIndex, seen)
            }
            if (!seen.has(refPos)) {
              seen.add(refPos)
              insertions.push({ position: refPos, length: 1 })
            }
          }
        }
      } else {
        const depthIdx = refPos - regionStart
        if (depthIdx >= 0 && depthIdx < length) {
          const refUpper = toUpper(refByte)
          for (const row of block.rows) {
            const sampleByte = row.alignmentBytes[col]!
            if (sampleByte !== DASH) {
              depths[depthIdx]! += 1
              const sampleUpper = toUpper(sampleByte)
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
