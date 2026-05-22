import type { AlignmentRecord, Sample } from '../types.ts'
import type { Feature, Region } from '@jbrowse/core/util'

interface InsertionInfo {
  sequence: string
  sampleIndex: number
}

/**
 * Worker-side: convert MAF features into per-sample sequence rows aligned to
 * `regions[0]`. With `showAllLetters`, every base is written; without it,
 * matches collapse to `.` and only mismatches show. `includeInsertions` adds
 * per-insert columns expanded to the max length across samples.
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

  // Use character arrays instead of strings for O(1) mutations
  const outputRowsArrays = samples.map(() => new Array(rlen).fill('-'))

  // Track insertions at each position if includeInsertions is enabled
  // Key is the reference position (0-based relative to region), value is array of insertions
  const insertionsAtPosition = new Map<number, InsertionInfo[]>()

  for (const feature of features.values()) {
    const leftCoord = feature.get('start')
    const vals = feature.get('alignments') as Record<string, AlignmentRecord>
    const seq = feature.get('seq') as string

    for (const [sample, val] of Object.entries(vals)) {
      const alignment = val.seq
      const row = sampleToRowMap.get(sample)
      if (row === undefined) {
        continue
      }

      const rowArray = outputRowsArrays[row]!

      for (let i = 0, o = 0, l = alignment.length; i < l; i++) {
        const seqChar = seq[i]!
        if (seqChar !== '-') {
          const alignChar = alignment[i]!
          const pos = leftCoord + o - region.start

          if (pos >= 0 && pos < rlen) {
            if (alignChar === '-') {
              rowArray[pos] = '-'
            } else if (alignChar !== ' ') {
              const c = alignChar.toLowerCase()
              if (showAllLetters) {
                rowArray[pos] = c
              } else if (seqChar.toLowerCase() === c) {
                rowArray[pos] = '.'
              } else {
                rowArray[pos] = c
              }
            }
          }
          o++
        } else if (includeInsertions) {
          let insertionSequence = ''
          while (i < alignment.length && seq[i] === '-') {
            const alignChar = alignment[i]!
            if (alignChar !== '-' && alignChar !== ' ') {
              insertionSequence += alignChar.toLowerCase()
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
      outputRowsArrays,
      insertionsAtPosition,
      samples.length,
    )
  }

  return outputRowsArrays.map(arr => arr.join(''))
}

/**
 * Expand sequences to include insertions: at each insertion position, every
 * row gains `maxLen` characters (the sample's own insertion padded with `-`,
 * or all `-` for samples without one). Walks each row once in order rather
 * than repeatedly splicing — splice-in-loop was O(n²) per row.
 */
function expandWithInsertions(
  outputRowsArrays: string[][],
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
    const row = outputRowsArrays[s]!
    const myIns = insBySampleAndPos[s]!
    const out: string[] = []
    let pi = 0
    for (let i = 0; i <= row.length; i++) {
      while (pi < sortedPositions.length && sortedPositions[pi] === i) {
        const pos = sortedPositions[pi]!
        const maxLen = maxLenByPos.get(pos)!
        const insSeq = myIns.get(pos)
        out.push(insSeq ? insSeq.padEnd(maxLen, '-') : '-'.repeat(maxLen))
        pi++
      }
      if (i < row.length) {
        out.push(row[i]!)
      }
    }
    result.push(out.join(''))
  }
  return result
}
