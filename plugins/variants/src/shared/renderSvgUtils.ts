import {
  abgrAlpha,
  abgrBlue,
  abgrGreen,
  abgrRed,
} from '@jbrowse/core/util/colorBits'

import type { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'
import type { ClusterHierarchyNode } from '@jbrowse/tree-sidebar'

export interface RenderSvgBaseModel {
  id: string
  cellData: unknown
  error: unknown
  regionTooLarge: boolean
  rowHeight: number
  scrollTop: number
  availableHeight: number
  height: number
  canDisplayLabels: boolean
  sources: { name: string }[] | undefined
  hierarchy: ClusterHierarchyNode | undefined
  showTree: boolean
  treeAreaWidth: number
}

export function setAbgrFill(ctx: SvgCanvas, c: number) {
  ctx.fillStyle = `rgb(${abgrRed(c)},${abgrGreen(c)},${abgrBlue(c)})`
  ctx.globalAlpha = abgrAlpha(c) / 255
}
