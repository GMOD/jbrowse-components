import type {
  HierarchyNode as TreeHierarchyNode,
  NewickNode,
} from '@jbrowse/tree-sidebar'

// Re-export Sample from central types
export type { Sample } from '../types.ts'

// MAF trees are NewickNodes; alias the shared tree-sidebar node
export type MafTreeNode = NewickNode
export type HierarchyNode = TreeHierarchyNode<MafTreeNode>
