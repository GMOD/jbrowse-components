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
  hierarchy?: ClusterHierarchyNode
  treeAreaWidth: number
  height: number
  showTree: boolean
  sources: { name: string; color?: string }[]
  subtreeFilter?: string[]
  setTreeCanvasRef: (ref: HTMLCanvasElement | null) => void
  setMouseoverCanvasRef: (ref: HTMLCanvasElement | null) => void
  setHoveredTreeNode: (node?: HoveredTreeNode) => void
  setTreeAreaWidth: (width: number) => void
  setSubtreeFilter: (names?: string[]) => void
}
