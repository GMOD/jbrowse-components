import { SvgRowLabels } from './SvgRowLabels.tsx'
import { SvgTreePath } from './SvgTreePath.tsx'

import type { ClusterHierarchyNode } from './types.ts'

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
}: {
  showTree: boolean
  hierarchy: ClusterHierarchyNode | undefined
  sources: { name: string; label?: string; labelColor?: string }[]
  rowHeight: number
  treeAreaWidth: number
  // Caller-specific label gate (e.g. hidden below a zoom threshold, or for a
  // single-source track). The tree still draws when this is false.
  showLabels?: boolean
  scrollTop?: number
  availableHeight?: number
}) {
  // Single source of truth for whether the tree occupies the gutter, so the
  // label offset can't disagree with whether the tree is actually drawn.
  const treeShowing = showTree && !!hierarchy
  return (
    <>
      {showLabels && sources.length ? (
        <SvgRowLabels
          sources={sources}
          rowHeight={rowHeight}
          labelOffset={treeShowing ? treeAreaWidth : 0}
          scrollTop={scrollTop}
          availableHeight={availableHeight}
        />
      ) : null}
      {treeShowing ? (
        <SvgTreePath hierarchy={hierarchy} scrollTop={scrollTop} />
      ) : null}
    </>
  )
}
