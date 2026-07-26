import {
  buildClusteredLayout,
  validateClusterOrder,
} from '@jbrowse/tree-sidebar'

import { expandSourcesToHaplotypes } from './getSources.ts'

import type { ProcessedSource, SampleInfo, Source } from './types.ts'

// Turn a cluster order into the display's next `layout`. One home for the three
// steps that have to agree, because the auto ("Run clustering") and manual (R
// script paste) paths both take them and would otherwise drift:
//
// - expand to haplotype rows in phased mode, so the order lines up with the
//   per-haplotype matrix the worker built (sources already carrying `HP` pass
//   through, so a re-cluster of an already-expanded set is idempotent)
// - merge against the existing layout, so colors and labels survive
// - re-append the rows a subtree filter is hiding. They weren't clustered and
//   aren't in the tree, but `layout` is the persisted record of every row's
//   position and color — dropping them here erases them for good once the
//   filter is cleared.
//
// Validation lives here rather than at the paste box because the length an order
// must cover is the *expanded* row count, which only this function knows: in
// phased mode a 2x-ploidy haplotype set is what the matrix (and so the order)
// was built over. An order from the RPC always covers it; a hand-pasted one is
// where a short or duplicated list would otherwise silently drop or double rows.
export function applyClusterOrder({
  sourcesBase,
  layout,
  order,
  renderingMode,
  sampleInfo,
}: {
  sourcesBase: ProcessedSource[]
  layout: Source[]
  order: number[]
  renderingMode: string
  sampleInfo?: Record<string, SampleInfo>
}): Source[] {
  const baseSources =
    renderingMode === 'phased' && sampleInfo
      ? expandSourcesToHaplotypes({ sources: sourcesBase, sampleInfo })
      : sourcesBase
  validateClusterOrder(order, baseSources.length)
  const clustered = buildClusteredLayout(baseSources, layout, order)
  const clusteredNames = new Set(clustered.map(s => s.name))
  return [...clustered, ...layout.filter(s => !clusteredNames.has(s.name))]
}
