export interface GraphNode {
  id: string
  name: string
  length: number
  depth: number
}

export interface GraphEdge {
  from: string
  to: string
  overlap: number
  pathIds?: string[]
}

export interface GraphPath {
  name: string
  nodeIds: string[]
  sample?: string
  haplotype?: number
  contig?: string
}

export interface Graph {
  name: string
  nodes: GraphNode[]
  edges: GraphEdge[]
  paths?: GraphPath[]
}

export interface NodeSegment {
  x: number
  y: number
}

export interface LayoutResult {
  nodePositions: Record<string, NodeSegment[]>
}

export type ColorScheme = 'uniform' | 'random' | 'depth' | 'gc-content' | 'grey'
