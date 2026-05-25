import type { Source } from '../types.ts'
import type {
  HierarchyNode,
  PositionedHierarchyNode,
  HoveredTreeNode as TreeSidebarHoveredTreeNode,
} from '@jbrowse/tree-sidebar'
import type { NewickNode } from '@jbrowse/tree-sidebar'

export interface ClusterNodeData extends NewickNode {
  height?: number
}

export type ClusterHierarchyNode = HierarchyNode<ClusterNodeData>

export type PositionedClusterHierarchyNode = PositionedHierarchyNode<ClusterNodeData>

export type HoveredTreeNode = TreeSidebarHoveredTreeNode

export interface TreeSidebarModel {
  totalHeight: number
  hierarchy?: PositionedClusterHierarchyNode
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
  hierarchy?: PositionedClusterHierarchyNode
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
