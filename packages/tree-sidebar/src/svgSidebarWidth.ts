import { bandLabelWidth } from './SvgBandLabels.tsx'
import { rowLabelsBoxWidth } from './rowLabelsBoxWidth.ts'
import { treeSidebarOffset } from './treeSidebarGeometry.ts'

import type { RowBand } from './arrangeRows.ts'
import type { ClusterHierarchyNode, RowLabelSource } from './types.ts'
import type { ExportTextStyle } from '@jbrowse/display-kit/types'

/** What a display's export sidebar draws, from its settings and loaded rows. */
export interface SvgSidebarProps {
  showTree: boolean
  hierarchy: ClusterHierarchyNode | undefined
  sources: RowLabelSource[]
  rowHeight: number
  treeAreaWidth: number
  showLabels?: boolean
  bands?: readonly RowBand[]
  /** Px of the export's left margin the display's own axes hold beside the plot. */
  leftInset?: number
}

export function svgSidebarWidth(
  {
    showTree,
    hierarchy,
    sources,
    rowHeight,
    treeAreaWidth,
    showLabels = true,
    bands = [],
    leftInset = 0,
  }: SvgSidebarProps,
  text?: ExportTextStyle,
) {
  const labels =
    showLabels && sources.length
      ? rowLabelsBoxWidth(sources, rowHeight, text)
      : 0
  const width =
    treeSidebarOffset({ showTree, hierarchy, treeAreaWidth }) +
    (bands.length ? bandLabelWidth(text) : 0) +
    labels
  return width > 0 ? width + leftInset : 0
}
