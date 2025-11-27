import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

export interface ReferringNode {
  node: IAnyStateTreeNode
  key: string
}
