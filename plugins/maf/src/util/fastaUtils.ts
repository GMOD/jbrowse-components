import type { AlignmentRecord, Sample } from '../types.ts'
import type { Feature, Region } from '@jbrowse/core/util'

interface InsertionInfo {
  sequence: string
  sampleIndex: number
}

/**
 * Process features into FASTA format
 * @param features - The features to process
 * @param selectedRegion - Optional region to extract
 * @returns FASTA formatted text
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
  showAsUpperCase?: boolean
  mismatchRendering?: boolean
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

  // Convert character arrays back to strings
  return outputRowsArrays.map(arr => arr.join(''))
}

/**
 * Expand sequences to include insertions
 * At each position with insertions, find the max insertion length,
 * then expand all sequences by that amount
 */
function expandWithInsertions(
  outputRowsArrays: string[][],
  insertionsAtPosition: Map<number, InsertionInfo[]>,
  numSamples: number,
) {
  // Sort insertion positions in descending order so we can insert from right to left
  // without affecting earlier positions
  const sortedPositions = [...insertionsAtPosition.keys()].sort((a, b) => b - a)

  for (const pos of sortedPositions) {
    const insertions = insertionsAtPosition.get(pos)!

    // Find max insertion length at this position
    let maxLen = 0
    for (const ins of insertions) {
      if (ins.sequence.length > maxLen) {
        maxLen = ins.sequence.length
      }
    }

    // Create a map from sample index to insertion sequence
    const sampleInsertions = new Map<number, string>()
    for (const ins of insertions) {
      sampleInsertions.set(ins.sampleIndex, ins.sequence)
    }

    // Insert characters at this position for each sample
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

  // Convert character arrays back to strings
  return outputRowsArrays.map(arr => arr.join(''))
}

/**
 * Build a FASTA-formatted string from per-sample raw sequences.
 * - `singleLine`: each record collapses to one line, with the sample label
 *   padded to a constant width so columns align in monospace.
 * - Otherwise: standard FASTA with `>label` on its own line.
 */
export function formatFastaSequences(
  rawSequences: string[],
  samples: Sample[] | undefined,
  singleLine: boolean,
): string {
  if (!samples || rawSequences.length === 0) {
    return ''
  }
  if (singleLine) {
    let maxLabelLength = 0
    for (const s of samples) {
      const len = (s.label ?? s.id).length
      if (len > maxLabelLength) {
        maxLabelLength = len
      }
    }
    return rawSequences
      .map((r, idx) => {
        const sample = samples[idx]!
        const label = sample.label ?? sample.id
        const padding = ' '.repeat(maxLabelLength - label.length + 2)
        return `>${label}${padding}${r}`
      })
      .join('\n')
  }
  return rawSequences
    .map((r, idx) => {
      const sample = samples[idx]!
      return `>${sample.label ?? sample.id}\n${r}`
    })
    .join('\n')
}
