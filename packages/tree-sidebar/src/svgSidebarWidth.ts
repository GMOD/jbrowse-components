import { BAND_LABEL_WIDTH } from './SvgBandLabels.tsx'
import { rowLabelsBoxWidth } from './rowLabelsBoxWidth.ts'
import { treeSidebarOffset } from './treeSidebarGeometry.ts'

import type { RowBand } from './arrangeRows.ts'
import type { ClusterHierarchyNode, RowLabelSource } from './types.ts'

export interface SvgSidebarProps {
  showTree: boolean
  hierarchy: ClusterHierarchyNode | undefined
  sources: RowLabelSource[]
  rowHeight: number
  treeAreaWidth: number
  showLabels?: boolean
  bands?: readonly RowBand[]
  leftInset?: number
}

export function svgSidebarWidth({
  showTree,
  hierarchy,
  sources,
  rowHeight,
  treeAreaWidth,
  showLabels = true,
  bands = [],
  leftInset = 0,
}: SvgSidebarProps) {
  const labels =
    showLabels && sources.length ? rowLabelsBoxWidth(sources, rowHeight) : 0
  const width =
    treeSidebarOffset({ showTree, hierarchy, treeAreaWidth }) +
    (bands.length ? BAND_LABEL_WIDTH : 0) +
    labels
  return width > 0 ? width + leftInset : 0
}
