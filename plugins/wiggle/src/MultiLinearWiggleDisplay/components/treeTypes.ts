import type { Source } from '../../util.ts'
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
  canDisplayLegendLabels: boolean
  rowHeight: number
  sources?: Source[]
  showTree: boolean
}
