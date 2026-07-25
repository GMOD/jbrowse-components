import type { Source } from './types.ts'
import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'
import type { SvgExportable } from '@jbrowse/core/svg/svgReady'
import type { ClusterHierarchyNode } from '@jbrowse/tree-sidebar'

export interface RenderSvgBaseModel extends SvgExportable {
  id: string
  cellData: CellDataResult | undefined
  regionTooLarge: boolean
  effectiveRowHeight: number
  scrollTop: number
  availableHeight: number
  height: number
  // Top strip the rows sit below (the matrix display's connector-line zone,
  // always 0 for the regular display). `availableHeight` already excludes it.
  lineZoneHeight: number
  canDisplayLabels: boolean
  sources: Source[] | undefined
  hierarchy: ClusterHierarchyNode | undefined
  showTree: boolean
  treeAreaWidth: number
}
