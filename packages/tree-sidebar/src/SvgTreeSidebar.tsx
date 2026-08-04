import { SvgRowLabels } from './SvgRowLabels.tsx'
import { SvgTreePath } from './SvgTreePath.tsx'
import { describeClusterProvenance } from './clusterProvenance.ts'
import { treeSidebarOffset } from './treeSidebarGeometry.ts'

import type { ClusterProvenance } from './clusterProvenance.ts'
import type { ClusterHierarchyNode, RowLabelSource } from './types.ts'
import type { ReactNode } from 'react'

// The SVG-export counterpart of the on-screen `TreeSidebar`: the left sidebar's
// dendrogram plus its row labels, rendered together. Every clusterable display's
// `renderSvg` should paint its sidebar through THIS, never `SvgRowLabels`
// directly — the two are coupled because the labels are offset right by
// `treeAreaWidth` to clear the tree, so drawing labels without the tree leaves a
// blank reserved gutter (the bug this component exists to prevent). Ordering is
// safe either way: the tree strokes occupy x∈[0,treeAreaWidth] and the labels
// x≥treeAreaWidth, so they never overlap.
export function SvgTreeSidebar({
  showTree,
  hierarchy,
  sources,
  rowHeight,
  treeAreaWidth,
  showLabels = true,
  scrollTop,
  availableHeight,
  labels,
  clusterProvenance,
}: {
  showTree: boolean
  hierarchy: ClusterHierarchyNode | undefined
  sources: RowLabelSource[]
  rowHeight: number
  treeAreaWidth: number
  // Caller-specific label gate (e.g. hidden below a zoom threshold, or for a
  // single-source track). The tree still draws when this is false.
  showLabels?: boolean
  scrollTop?: number
  availableHeight?: number
  // Replaces the default `SvgRowLabels` with the caller's own label renderer,
  // drawn at the same tree-aware offset. For a display whose on-screen sidebar
  // is more than a label box — variants prefixes each label with a `color`
  // swatch, which `SvgRowLabels` has no notion of — pass the live component
  // itself, so the export can't drift from what the screen shows. It gets the
  // same offset gate, which is the whole reason this wrapper exists.
  labels?: ReactNode
  // What the tree was computed from, captioned above it. Undefined for a tree
  // that arrives as data (maf's `.nh` phylogeny), which has no locus.
  clusterProvenance?: ClusterProvenance
}) {
  // Single source of truth for whether the tree occupies the gutter, so the
  // label offset can't disagree with whether the tree is actually drawn.
  const treeShowing = showTree && !!hierarchy
  const labelOffset = treeSidebarOffset({ showTree, hierarchy, treeAreaWidth })
  return (
    <>
      {/*
        The locus travels with the exported figure, because the export is where
        a dendrogram is most likely to be read as a claim about the samples
        rather than about a window. On screen the reader can at least check the
        location box; in a PNG dropped into a paper there is nothing else left
        to check against. Drawn full-width above the rows rather than inside the
        tree gutter, which is `treeAreaWidth` (80px by default) and cannot hold
        a locus string.
      */}
      {treeShowing && clusterProvenance ? (
        <text x={0} y={-4} fontSize={11} fill="#666">
          {describeClusterProvenance(clusterProvenance)}
        </text>
      ) : null}
      {showLabels && sources.length ? (
        labels === undefined ? (
          <SvgRowLabels
            sources={sources}
            rowHeight={rowHeight}
            labelOffset={labelOffset}
            scrollTop={scrollTop}
            availableHeight={availableHeight}
          />
        ) : (
          <g transform={`translate(${labelOffset} 0)`}>{labels}</g>
        )
      ) : null}
      {treeShowing ? (
        <SvgTreePath hierarchy={hierarchy} scrollTop={scrollTop} />
      ) : null}
    </>
  )
}
