import type { Source } from '../types.ts'
import type {
  ClusterHierarchyNode,
  TreeSidebarModel as TreeSidebarModelBase,
} from '@jbrowse/tree-sidebar'

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

export {
  type ClusterHierarchyNode,
  type ClusterNodeData,
  type HoveredTreeNode,
} from '@jbrowse/tree-sidebar'
