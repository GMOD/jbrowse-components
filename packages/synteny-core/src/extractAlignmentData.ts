import type { Feature } from '@jbrowse/core/util'
import type { AlignmentData } from '@jbrowse/core/util/diagonalizeRegions'

/**
 * Extract diagonalization input (one entry per mated alignment) from raw
 * comparative features. Shared by the dotplot and synteny diagonalize RPCs so
 * both feed `diagonalizeRegions` from the same feature shape — a feature with a
 * `mate` (the paired location on the other assembly), `refName`, `start`,
 * `end`, and `strand`. Features without a `mate` are skipped.
 *
 * Features are fetched with adapter-space regions, so their `refName`/
 * `mate.refName` come back in the adapter's namespace. The optional
 * `refRefNameMap`/`queryRefNameMap` (both adapter refName -> canonical refName)
 * translate the reference and query axes back into the view's canonical
 * namespace so the diagonalization can match them against canonical regions and
 * hand canonical regions back to the view. A refName absent from a map is
 * already canonical (no alias) and passes through unchanged; an omitted map
 * leaves that axis in adapter space (fine when the caller passes adapter-space
 * regions for that axis).
 */
export function extractAlignmentData(
  features: Feature[],
  {
    refRefNameMap = {},
    queryRefNameMap = {},
  }: {
    refRefNameMap?: Record<string, string>
    queryRefNameMap?: Record<string, string>
  } = {},
): AlignmentData[] {
  const out: AlignmentData[] = []
  for (const feat of features) {
    const mate = feat.get('mate') as
      | { refName: string; start: number; end: number }
      | undefined
    if (mate) {
      const refName = feat.get('refName')
      out.push({
        refRefName: refRefNameMap[refName] ?? refName,
        queryRefName: queryRefNameMap[mate.refName] ?? mate.refName,
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
