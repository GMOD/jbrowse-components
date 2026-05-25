import type { Source } from '../types.ts'
import type {
  ClusterHierarchyNode,
  ClusterNodeData,
  HoveredTreeNode,
  TreeSidebarModel as TreeSidebarModelBase,
} from '@jbrowse/tree-sidebar'

export type { ClusterHierarchyNode, ClusterNodeData, HoveredTreeNode }

export interface TreeSidebarModel extends TreeSidebarModelBase {
  sources?: Source[]
  setSubtreeFilter: (names?: string[]) => void
}

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
}

export interface MouseState {
  x: number
  y: number
  offsetX: number
  offsetY: number
}
