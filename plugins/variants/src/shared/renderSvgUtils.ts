import type { SvgExportable } from '@jbrowse/core/svg/svgReady'
import type { ClusterHierarchyNode } from '@jbrowse/tree-sidebar'

export interface RenderSvgBaseModel extends SvgExportable {
  id: string
  cellData: unknown
  regionTooLarge: boolean
  effectiveRowHeight: number
  scrollTop: number
  availableHeight: number
  height: number
  canDisplayLabels: boolean
  sources: { name: string }[] | undefined
  hierarchy: ClusterHierarchyNode | undefined
  showTree: boolean
  treeAreaWidth: number
}
