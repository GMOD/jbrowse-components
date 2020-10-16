import { IAnyStateTreeNode } from 'mobx-state-tree'

export interface ReferringNode {
  node: IAnyStateTreeNode
  key: string
}
