import type { Feature } from '@jbrowse/core/util'
import type { AlignmentData } from '@jbrowse/core/util/diagonalizeRegions'

/**
 * Extract diagonalization input (one entry per mated alignment) from raw
 * comparative features. Shared by the dotplot and synteny diagonalize RPCs so
 * both feed `diagonalizeRegions` from the same feature shape — a feature with a
 * `mate` (the paired location on the other assembly), `refName`, `start`,
 * `end`, and `strand`. Features without a `mate` are skipped.
 */
export function extractAlignmentData(features: Feature[]): AlignmentData[] {
  const out: AlignmentData[] = []
  for (const feat of features) {
    const mate = feat.get('mate') as
      { refName: string; start: number; end: number } | undefined
    if (mate) {
      out.push({
        refRefName: feat.get('refName'),
        queryRefName: mate.refName,
        refStart: feat.get('start'),
        refEnd: feat.get('end'),
        queryStart: mate.start,
        queryEnd: mate.end,
        strand: feat.get('strand') ?? 1,
      })
    }
  }
  return out
}
