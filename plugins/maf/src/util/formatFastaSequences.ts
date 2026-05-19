import type { Sample } from '../types.ts'

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
  return rawSequences
    .map((r, idx) => `>${samples[idx]!.label}\n${r}`)
    .join('\n')
}
