import { AnyConfigurationModel } from '@jbrowse/core/configuration'

// locals
import { TreeNode } from '../../generateHierarchy'
import { HierarchicalTrackSelectorModel } from '../../model'

export function getNodeData(
  node: TreeNode,
  nestingLevel: number,
  extra: Record<string, unknown>,
  selection: Record<string, unknown>,
) {
  const isLeaf = node.type === 'track'
  const selected = isLeaf ? selection[node.trackId] : false
  return {
    data: {
      defaultHeight: isLeaf ? 22 : 40,
      isLeaf,
      isOpenByDefault: true,
      nestingLevel,
      selected,
      ...node,
      ...extra,
    },
    nestingLevel,
    node,
  }
}

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

export type NodeEntry = ReturnType<typeof getNodeData>
