import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { HierarchicalTrackSelectorModel, TreeNode } from '../model'

export interface NodeData {
  nestingLevel: number
  checked: boolean
  conf: AnyConfigurationModel
  drawerPosition: unknown
  id: string
  isLeaf: boolean
  name: string
  onChange: Function
  toggleCollapse: (arg: string) => void
  tree: TreeNode
  selected: boolean
  model: HierarchicalTrackSelectorModel
}

export function getAllChildren(subtree?: TreeNode): AnyConfigurationModel[] {
  // @ts-expect-error
  return (
    subtree?.children.map(t =>
      t.children.length ? getAllChildren(t) : (t.conf as AnyConfigurationModel),
    ) || []
  ).flat(Infinity)
}

export function treeToMap(tree: TreeNode, map = new Map<string, TreeNode>()) {
  if (tree.id && tree.children.length) {
    map.set(tree.id, tree)
  }
  for (let i = 0; i < tree.children.length; i++) {
    const node = tree.children[i]
    treeToMap(node, map)
  }
  return map
}

export function isUnsupported(name = '') {
  return name.endsWith('(Unsupported)') || name.endsWith('(Unknown)')
}
