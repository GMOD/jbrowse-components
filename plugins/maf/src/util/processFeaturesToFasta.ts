import { DASH, LOWER_BIT, SPACE } from './asciiBytes.ts'

import type { AlignmentRecord, Sample } from '../types.ts'
import type { Feature, Region } from '@jbrowse/core/util'

interface InsertionInfo {
  sequence: string
  sampleIndex: number
}

const DOT = 46 // '.'.charCodeAt(0)

const decoder = new TextDecoder()

/**
 * Worker-side: convert MAF features into per-sample sequence rows aligned to
 * `regions[0]`. With `showAllLetters`, every base is written; without it,
 * matches collapse to `.` and only mismatches show. `includeInsertions` adds
 * per-insert columns expanded to the max length across samples.
 *
 * Hot loop: char-codes + ASCII bit math (`code | 0x20` to compare in
 * lowercase) — same trick the renderers use. Per-row output is a Uint8Array
 * decoded once at the end rather than a string[] joined per cell.
 */
export function processFeaturesToFasta({
  regions,
  showAllLetters,
  samples,
  features,
  includeInsertions,
}: {
  regions: Region[]
  samples: Sample[]
  showAllLetters?: boolean
  includeInsertions?: boolean
  features: Map<string, Feature>
}) {
  const region = regions[0]!
  const sampleToRowMap = new Map(samples.map((s, i) => [s.id, i]))
  const rlen = region.end - region.start

  // Byte-per-cell rows pre-filled with '-' (DASH). Compared to string[][],
  // writes are a single indexed store and the final decode is one call.
  const outputRowsBytes = samples.map(() => new Uint8Array(rlen).fill(DASH))

  // Track insertions at each position if includeInsertions is enabled
  // Key is the reference position (0-based relative to region), value is array of insertions
  const insertionsAtPosition = new Map<number, InsertionInfo[]>()

  for (const feature of features.values()) {
    const leftCoord = feature.get('start')
    const vals = feature.get('alignments') as Record<string, AlignmentRecord>
    const seq = feature.get('seq') as string
    const seqLen = seq.length

    for (const sample in vals) {
      const row = sampleToRowMap.get(sample)
      if (row === undefined) {
        continue
      }
      const alignment = vals[sample]!.seq
      const alignLen = alignment.length
      const rowBytes = outputRowsBytes[row]!
      const len = Math.min(alignLen, seqLen)

      for (let i = 0, o = 0; i < len; i++) {
        const seqCode = seq.charCodeAt(i)
        if (seqCode !== DASH) {
          const alnCode = alignment.charCodeAt(i)
          const pos = leftCoord + o - region.start

          if (pos >= 0 && pos < rlen) {
            if (alnCode === DASH) {
              rowBytes[pos] = DASH
            } else if (alnCode !== SPACE) {
              const lowerAln = alnCode | LOWER_BIT
              rowBytes[pos] =
                !showAllLetters && (seqCode | LOWER_BIT) === lowerAln
                  ? DOT
                  : lowerAln
            }
          }
          o++
        } else if (includeInsertions) {
          let insertionSequence = ''
          while (i < len && seq.charCodeAt(i) === DASH) {
            const alnCode = alignment.charCodeAt(i)
            if (alnCode !== DASH && alnCode !== SPACE) {
              insertionSequence += String.fromCharCode(alnCode | LOWER_BIT)
            }
            i++
          }
          i--

          if (insertionSequence.length > 0) {
            const insertPos = leftCoord + o - region.start
            if (insertPos >= 0 && insertPos <= rlen) {
              const existing = insertionsAtPosition.get(insertPos) ?? []
              existing.push({ sequence: insertionSequence, sampleIndex: row })
              insertionsAtPosition.set(insertPos, existing)
            }
          }
        }
      }
    }
  }

  if (includeInsertions && insertionsAtPosition.size > 0) {
    return expandWithInsertions(
      outputRowsBytes,
      insertionsAtPosition,
      samples.length,
    )
  }

  return outputRowsBytes.map(arr => decoder.decode(arr))
}

/**
 * Expand sequences to include insertions: at each insertion position, every
 * row gains `maxLen` characters (the sample's own insertion padded with `-`,
 * or all `-` for samples without one). Walks each row once in order rather
 * than repeatedly splicing — splice-in-loop was O(n²) per row.
 */
function expandWithInsertions(
  outputRowsBytes: Uint8Array[],
  insertionsAtPosition: Map<number, InsertionInfo[]>,
  numSamples: number,
) {
  const sortedPositions = [...insertionsAtPosition.keys()].sort((a, b) => a - b)
  const maxLenByPos = new Map<number, number>()
  const insBySampleAndPos: Map<number, string>[] = []
  for (let i = 0; i < numSamples; i++) {
    insBySampleAndPos.push(new Map())
  }
  for (const pos of sortedPositions) {
    let maxLen = 0
    for (const ins of insertionsAtPosition.get(pos)!) {
      if (ins.sequence.length > maxLen) {
        maxLen = ins.sequence.length
      }
      insBySampleAndPos[ins.sampleIndex]!.set(pos, ins.sequence)
    }
    maxLenByPos.set(pos, maxLen)
  }

  const result: string[] = []
  for (let s = 0; s < numSamples; s++) {
    const rowStr = decoder.decode(outputRowsBytes[s])
    const myIns = insBySampleAndPos[s]!
    const out: string[] = []
    let lastI = 0
    for (const pos of sortedPositions) {
      if (pos > lastI) {
        out.push(rowStr.slice(lastI, pos))
        lastI = pos
      }
      const maxLen = maxLenByPos.get(pos)!
      const insSeq = myIns.get(pos)
      out.push(insSeq ? insSeq.padEnd(maxLen, '-') : '-'.repeat(maxLen))
    }
    if (lastI < rowStr.length) {
      out.push(rowStr.slice(lastI))
    }
    result.push(out.join(''))
  }
  return result
}
