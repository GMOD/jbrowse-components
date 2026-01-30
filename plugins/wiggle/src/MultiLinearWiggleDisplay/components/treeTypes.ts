import type { Source } from '../../util.ts'
import type { HierarchyNode } from 'd3-hierarchy'

export interface ClusterNodeData {
  name: string
  height: number
  children?: ClusterNodeData[]
}

export type ClusterHierarchyNode = HierarchyNode<ClusterNodeData>

export interface HoveredTreeNode {
  node: ClusterHierarchyNode
  descendantNames: string[]
}

export interface TreeSidebarModel {
  totalHeight: number
  hierarchy?: ClusterHierarchyNode
  treeAreaWidth: number
  height: number
  scrollTop: number
  showTree: boolean
  sources?: Source[]
  subtreeFilter?: string[]
  setTreeCanvasRef: (ref: HTMLCanvasElement | null) => void
  setMouseoverCanvasRef: (ref: HTMLCanvasElement | null) => void
  setHoveredTreeNode: (node?: HoveredTreeNode) => void
  setTreeAreaWidth: (width: number) => void
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
