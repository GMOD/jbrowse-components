import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { HierarchicalTrackSelectorModel } from '../model'
import { TreeNode } from '../generateHierarchy'
import { MenuItem } from '@jbrowse/core/ui'

export interface NodeData {
  nestingLevel: number
  checked: boolean
  conf: AnyConfigurationModel
  drawerPosition: unknown
  id: string
  trackId: string
  isLeaf: boolean
  name: string
  onChange: Function
  toggleCollapse: (arg: string) => void
  tree: TreeNode
  selected: boolean
  menuItems?: MenuItem[]
  model: HierarchicalTrackSelectorModel
}

export function getAllChildren(subtree?: TreeNode): AnyConfigurationModel[] {
  // @ts-expect-error
  return subtree?.type === 'category'
    ? subtree.children
        .map(t => (t.type === 'category' ? getAllChildren(t) : t.conf))
        .flat(Infinity)
    : []
}

export function treeToMap(tree: TreeNode, map = new Map<string, TreeNode>()) {
  if (tree.id && tree.children.length) {
    map.set(tree.id, tree)
  }
  for (const node of tree.children) {
    treeToMap(node, map)
  }
  return map
}

export function isUnsupported(name = '') {
  return name.endsWith('(Unsupported)') || name.endsWith('(Unknown)')
}
