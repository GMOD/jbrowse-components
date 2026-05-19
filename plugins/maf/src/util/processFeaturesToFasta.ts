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
 * Expand sequences to include insertions: at each insertion position, find the
 * max insertion length across samples, then splice that many columns into
 * every row (filled with the sample's own insertion or `-` for samples with
 * no insertion). Right-to-left iteration so earlier positions remain valid.
 */
function expandWithInsertions(
  outputRowsArrays: string[][],
  insertionsAtPosition: Map<number, InsertionInfo[]>,
  numSamples: number,
) {
  const sortedPositions = [...insertionsAtPosition.keys()].sort((a, b) => b - a)

  for (const pos of sortedPositions) {
    const insertions = insertionsAtPosition.get(pos)!

    let maxLen = 0
    for (const ins of insertions) {
      if (ins.sequence.length > maxLen) {
        maxLen = ins.sequence.length
      }
    }

    const sampleInsertions = new Map<number, string>()
    for (const ins of insertions) {
      sampleInsertions.set(ins.sampleIndex, ins.sequence)
    }

    for (let sampleIdx = 0; sampleIdx < numSamples; sampleIdx++) {
      const rowArray = outputRowsArrays[sampleIdx]!
      const insertionSeq = sampleInsertions.get(sampleIdx)

      if (insertionSeq) {
        const paddedInsertion = insertionSeq.padEnd(maxLen, '-')
        for (let k = paddedInsertion.length - 1; k >= 0; k--) {
          rowArray.splice(pos, 0, paddedInsertion[k]!)
        }
      } else {
        for (let k = 0; k < maxLen; k++) {
          rowArray.splice(pos, 0, '-')
        }
      }
    }
  }

  return outputRowsArrays.map(arr => arr.join(''))
}
