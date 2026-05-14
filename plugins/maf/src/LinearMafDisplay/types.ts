import type { HierarchyNode as TreeHierarchyNode } from '@jbrowse/tree-sidebar'

// Re-export Sample from central types
export type { Sample } from '../types'

export interface NodeWithIds {
  id: string
  name: string
  children?: NodeWithIds[]
  length?: number
  noTree?: boolean
}

// MAF trees are hierarchies of NodeWithIds; alias the shared tree-sidebar node
export type HierarchyNode = TreeHierarchyNode<NodeWithIds>
