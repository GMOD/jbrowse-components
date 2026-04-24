import type { HierarchyNode } from './hierarchy.ts'
import type Flatbush from '@jbrowse/core/util/flatbush'

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

export interface TreeSource {
  name: string
  color?: string
}

export interface TreeSidebarModel {
  totalHeight?: number
  hierarchy?: ClusterHierarchyNode
  treeAreaWidth: number
  height: number
  lineZoneHeight?: number
  scrollTop?: number
  showTree: boolean
  sources?: TreeSource[]
  subtreeFilter?: string[]
  spatialIndex?: {
    index: Flatbush
    nodes: ClusterHierarchyNode[]
  }
  setTreeCanvasRef: (ref: HTMLCanvasElement | null) => void
  setMouseoverCanvasRef: (ref: HTMLCanvasElement | null) => void
  setHoveredTreeNode: (node?: HoveredTreeNode) => void
  setTreeAreaWidth: (width: number) => void
  setSubtreeFilter: (names?: string[]) => void
}

export interface TreeDrawingModel {
  treeCanvas?: HTMLCanvasElement | null
  mouseoverCanvas?: HTMLCanvasElement | null
  hierarchy?: ClusterHierarchyNode
  treeAreaWidth: number
  height: number
  scrollTop?: number
  rowHeight: number
  totalHeight?: number
  hoveredTreeNode?: HoveredTreeNode
  sources?: TreeSource[]
  isMinimized?: boolean
}
