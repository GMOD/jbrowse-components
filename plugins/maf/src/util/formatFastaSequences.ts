import { formatSeqFasta } from '@jbrowse/core/util/formatFastaStrings'

import type { Sample } from '../types.ts'

/**
 * Build a FASTA-formatted string from per-sample raw sequences.
 * - `singleLine`: each record collapses to one line, with the sample label
 *   padded to a constant width so columns align in monospace. Deliberately not
 *   FASTA — it is the shape you read a column of aligned species in.
 * - Otherwise: standard FASTA through core's `formatSeqFasta`, which wraps the
 *   sequence at 80 columns. This used to emit each record as one unwrapped
 *   line, which the spec does not ask for and some tools will not read — and it
 *   made the two modes differ only in the label padding, so the "single line"
 *   option was almost a no-op.
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
      if (s.label.length > maxLabelLength) {
        maxLabelLength = s.label.length
      }
    }
    return rawSequences
      .map((r, idx) => {
        const { label } = samples[idx]!
        const padding = ' '.repeat(maxLabelLength - label.length + 2)
        return `>${label}${padding}${r}`
      })
      .join('\n')
  }
  return formatSeqFasta(
    rawSequences.map((seq, idx) => ({ header: samples[idx]!.label, seq })),
  )
}
