import { bandLabelWidth } from './SvgBandLabels.tsx'
import { rowLabelsBoxWidth } from './rowLabelsBoxWidth.ts'
import { treeSidebarOffset } from './treeSidebarGeometry.ts'

import type { RowBand } from './arrangeRows.ts'
import type {
  ClusterHierarchyNode,
  RowAnnotationColumn,
  RowLabelSource,
} from './types.ts'
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
  /** The `rows.annotations` columns, the mixin's `rowAnnotationColors`. */
  annotations?: readonly RowAnnotationColumn[]
  /** The label over each color column, the mixin's `rowColumnLabels`. */
  columnLabels?: readonly string[]
  /** Px of the export's left margin the display's own axes hold beside the plot. */
  leftInset?: number
}

/**
 * Px the dendrogram, band strip and row labels take together: the panel a
 * display's left axis sits past on screen.
 */
export function sidebarPanelWidth(
  {
    showTree,
    hierarchy,
    sources,
    rowHeight,
    treeAreaWidth,
    showLabels = true,
    bands = [],
    annotations,
  }: SvgSidebarProps,
  text?: ExportTextStyle,
) {
  const labels =
    showLabels && sources.length
      ? rowLabelsBoxWidth(sources, rowHeight, text, annotations)
      : 0
  return (
    treeSidebarOffset({ showTree, hierarchy, treeAreaWidth }) +
    (bands.length ? bandLabelWidth(text) : 0) +
    labels
  )
}

export function svgSidebarWidth(
  sidebar: SvgSidebarProps,
  text?: ExportTextStyle,
) {
  const width = sidebarPanelWidth(sidebar, text)
  return width > 0 ? width + (sidebar.leftInset ?? 0) : 0
}
