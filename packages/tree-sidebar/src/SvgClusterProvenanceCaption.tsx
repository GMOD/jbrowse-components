import { describeClusterProvenance } from './clusterProvenance.ts'

import type { ClusterProvenance } from './clusterProvenance.ts'

/**
 * The locus a dendrogram was computed from, captioned above it in an SVG
 * export. Renders nothing without a provenance — a tree that arrives as data
 * (maf's `.nh` phylogeny) has no locus to state.
 *
 * The caption exists because an export is where a dendrogram is most likely to
 * be read as a claim about the samples rather than about a window: on screen
 * the reader can at least check the location box, and in a PNG dropped into a
 * paper there is nothing else left to check against. Drawn full-width above the
 * rows rather than inside the tree gutter, which is `treeAreaWidth` (80px by
 * default) and cannot hold a locus string.
 *
 * Its own component because two exports draw it. `SvgTreeSidebar` owns the
 * sidebar for every display that can use that wrapper; multi-wiggle cannot —
 * its row labels live in `MultiWiggleSvgScales`, beside the per-row scalebars —
 * so its body assembles the sidebar itself and had re-stated all four of these
 * literals. They agreed, and the point is that nothing was keeping them
 * agreeing: the caption's color in particular is a bare `#666` that a themed
 * export would have to move, and moving it in the shared component alone would
 * have left multi-wiggle behind without a failing test anywhere.
 *
 * Whether the tree is showing at all stays the caller's gate — each already
 * resolves it (`treeShowing`, `labelOffset && hierarchy`) for the rest of its
 * sidebar.
 */
export function SvgClusterProvenanceCaption({
  clusterProvenance,
}: {
  clusterProvenance: ClusterProvenance | undefined
}) {
  return clusterProvenance ? (
    <text x={0} y={-4} fontSize={11} fill="#666">
      {describeClusterProvenance(clusterProvenance)}
    </text>
  ) : null
}
