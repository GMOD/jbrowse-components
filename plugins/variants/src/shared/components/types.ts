import type { Source } from '../types.ts'
import type { ClusterHierarchyNode } from '@jbrowse/tree-sidebar'

export interface LegendBarModel {
  id: string
  scrollTop: number
  height: number
  hierarchy?: ClusterHierarchyNode
  treeAreaWidth: number
  totalHeight: number
  canDisplayLabels: boolean
  rowHeight: number
  sources?: Source[]
  showTree: boolean
  showLegend: boolean
}

export interface MouseState {
  x: number
  y: number
  offsetX: number
  offsetY: number
}
