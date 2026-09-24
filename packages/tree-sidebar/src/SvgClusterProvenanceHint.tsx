import { usePalette } from '@jbrowse/core/ui/PaletteContext'

import {
  clusterProvenanceDrifted,
  clusterProvenanceLocLabel,
} from './clusterProvenance.ts'

import type {
  ClusterProvenance,
  ClusterProvenanceRegion,
} from './clusterProvenance.ts'

/**
 * The SVG-export twin of `ClusterProvenanceHint`: at the top of the tree
 * gutter, and only once the view has drifted off the span the tree was
 * clustered on, which is the one state where the dendrogram silently describes
 * something other than the rows beside it. A tree computed on what the figure
 * shows needs no caption, the same call the screen makes. Halo, not a box: it
 * sits over the first row's label, as the chip does.
 */
export function SvgClusterProvenanceHint({
  clusterProvenance,
  contentBlocks,
}: {
  clusterProvenance: ClusterProvenance | undefined
  contentBlocks: readonly ClusterProvenanceRegion[]
}) {
  const palette = usePalette()
  return clusterProvenance &&
    clusterProvenanceDrifted(clusterProvenance, contentBlocks) ? (
    <text
      x={2}
      y={12}
      fontSize={11}
      fill={palette.warning.dark}
      stroke={palette.background.paper}
      strokeWidth={3}
      paintOrder="stroke"
    >
      {`⚠ ${clusterProvenanceLocLabel(clusterProvenance)}`}
    </text>
  ) : null
}
