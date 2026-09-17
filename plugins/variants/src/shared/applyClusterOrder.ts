import {
  buildClusteredLayout,
  rotateClusterRun,
  validateClusterOrder,
} from '@jbrowse/tree-sidebar'

import { expandSourcesToHaplotypes, resolveSampleName } from './getSources.ts'

import type { ProcessedSource, SampleInfo, Source } from './types.ts'

// Turn a cluster order into the display's next `layout`, and the run's
// dendrogram into the one to store beside it. One home for the four steps that
// have to agree, because the auto ("Run clustering") and manual (R script
// paste) paths both take them and would otherwise drift:
//
// - rotate the run's tree towards the config `domain` and re-read the order off
//   it, so a domain-seeded track composes with the run instead of losing its
//   leading rows to it. The paste path passes no tree and rotates nothing.
// - expand to haplotype rows in phased mode, so the order lines up with the
//   per-haplotype matrix the worker built (sources already carrying `HP` pass
//   through, so a re-cluster of an already-expanded set is idempotent)
// - merge against the existing layout, so colors and labels survive
// - re-append the rows a subtree filter is hiding. They weren't clustered and
//   aren't in the tree, but `layout` is the persisted record of every row's
//   position and color — dropping them here erases them for good once the
//   filter is cleared. Matching them is by `name` for a haplotype row and by
//   SAMPLE for a bare sample row, which is the same "covered" rule `getSources`
//   states: a phased run replaces one sample row with its haplotypes, and a
//   name-only test reads "NA07056" as uncovered by "NA07056 HP0" and appends the
//   sample back on top of its own haplotypes. That layout then expands a second
//   time on the way to `sources` — 150 samples came back as 450 layout rows and
//   600 drawn rows against a 300-leaf tree, so `treeDescribesRows` refused the
//   dendrogram and half the rows had no cells. A bare sample row is the only
//   thing superseded; a hidden HAPLOTYPE row is kept even when its sibling
//   clustered, since the filter may be hiding exactly one of a pair.
//
// Validation lives here rather than at the paste box because the rows an order
// must cover are the *expanded* ones, which only this function knows: in phased
// mode a 2x-ploidy haplotype set is what the matrix (and so the order) was built
// over. An order from the RPC always covers it; a hand-pasted one is where a
// short or duplicated list would otherwise silently drop or double rows, and
// where `matrixRowNames` catches a row set that moved during the trip to R —
// a sample filter, or phasing switching on as `sampleInfo` arrives.
export function applyClusterOrder({
  sourcesBase,
  layout,
  order,
  tree,
  domain = [],
  renderingMode,
  sampleInfo,
  matrixRowNames,
}: {
  sourcesBase: ProcessedSource[]
  layout: Source[]
  order: number[]
  tree?: string
  domain?: readonly string[]
  renderingMode: string
  sampleInfo?: Record<string, SampleInfo>
  matrixRowNames?: string[]
}): { layout: Source[]; tree?: string } {
  const baseSources =
    renderingMode === 'phased' && sampleInfo
      ? expandSourcesToHaplotypes({ sources: sourcesBase, sampleInfo })
      : sourcesBase
  const rotated = rotateClusterRun({
    rows: baseSources,
    order,
    tree,
    domain,
  })
  validateClusterOrder(rotated.order, baseSources, matrixRowNames)
  const clustered = buildClusteredLayout(baseSources, layout, rotated.order)
  const clusteredNames = new Set(clustered.map(s => s.name))
  const clusteredSamples = new Set(clustered.map(resolveSampleName))
  return {
    layout: [
      ...clustered,
      ...layout.filter(
        s =>
          !clusteredNames.has(s.name) &&
          !(s.HP === undefined && clusteredSamples.has(resolveSampleName(s))),
      ),
    ],
    tree: rotated.tree,
  }
}
