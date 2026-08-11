import { SvgClusterProvenanceCaption } from './SvgClusterProvenanceCaption.tsx'
import { SvgRowLabels } from './SvgRowLabels.tsx'
import { SvgTreePath } from './SvgTreePath.tsx'
import { treeIsShowing, treeSidebarOffset } from './treeSidebarGeometry.ts'

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
  // The tree, but only if it is showing — one binding rather than a boolean
  // beside the hierarchy it is about, so the caption, the path and the label
  // offset cannot come apart. `treeSidebarOffset` is this same gate times
  // `treeAreaWidth`; the two used to be spelled out separately here, under a
  // comment claiming they were one.
  const drawnTree = treeIsShowing({ showTree, hierarchy })
    ? hierarchy
    : undefined
  const labelOffset = treeSidebarOffset({ showTree, hierarchy, treeAreaWidth })
  return (
    <>
      {/* see SvgClusterProvenanceCaption for why the locus travels with the
          exported figure, and why multi-wiggle draws the same caption without
          going through this component */}
      {drawnTree ? (
        <SvgClusterProvenanceCaption clusterProvenance={clusterProvenance} />
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
      {drawnTree ? (
        <SvgTreePath hierarchy={drawnTree} scrollTop={scrollTop} />
      ) : null}
    </>
  )
}
