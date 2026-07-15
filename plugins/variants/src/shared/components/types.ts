import type { Source } from '../types.ts'
import type { ClusterHierarchyNode } from '@jbrowse/tree-sidebar'

export interface RowColorsModel {
  id: string
  scrollTop: number
  height: number
  hierarchy?: ClusterHierarchyNode
  treeAreaWidth: number
  totalHeight: number
  canDisplayLabels: boolean
  effectiveRowHeight: number
  sources?: Source[]
  showTree: boolean
}

export interface MouseState {
  x: number
  y: number
  clientX: number
  clientY: number
}
