import { getLinkAttributes } from 'gff-nostream'

import type { LazyGffFeature } from 'gff-nostream'

// GFF3 lets one feature span several lines under one ID. gff-nostream attaches
// each continuation line of a child to its parent, but hands back every line
// of a parentless one as its own item, so an NCBI cDNA_match — one line per
// aligned exon block, no Parent — arrived as a feature per block. The first
// line becomes the feature, spanning every block, with each block, its own
// included, as a subfeature of the same type. A single-line feature is left
// as it was.
export function groupDiscontinuous<T extends { feature: LazyGffFeature }>(
  items: T[],
): T[] {
  const firstById = new Map<string, T>()
  const split = new Set<T>()
  const out: T[] = []
  for (const item of items) {
    const { id } = getLinkAttributes(item.feature)
    const key = Array.isArray(id) ? id[0] : id
    const first = key === undefined ? undefined : firstById.get(key)
    if (first === undefined) {
      if (key !== undefined) {
        firstById.set(key, item)
      }
      out.push(item)
      continue
    }
    const container = first.feature
    if (!split.has(first)) {
      split.add(first)
      const { subfeatures, ...block } = container
      container.subfeatures = [...subfeatures, { ...block, subfeatures: [] }]
    }
    container.start = Math.min(container.start, item.feature.start)
    container.end = Math.max(container.end, item.feature.end)
    container.subfeatures.push(item.feature)
  }
  return out
}
