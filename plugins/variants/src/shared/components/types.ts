import type { HierarchyNode } from 'd3-hierarchy'

export interface ClusterNodeData {
  name: string
  height: number
  children?: ClusterNodeData[]
}

export type ClusterHierarchyNode = HierarchyNode<ClusterNodeData>

export interface TreeSidebarModel {
  totalHeight: number
  hierarchy?: ClusterHierarchyNode
  treeAreaWidth: number
  height: number
  scrollTop: number
  showTree: boolean
  setTreeCanvasRef: (ref: HTMLCanvasElement | null) => void
  setMouseoverCanvasRef: (ref: HTMLCanvasElement | null) => void
  setHoveredTreeNode: (node?: {
    node: ClusterHierarchyNode
    descendantNames: string[]
  }) => void
  setTreeAreaWidth: (width: number) => void
}

export interface MouseState {
  x: number
  y: number
  offsetX: number
  offsetY: number
}
