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
