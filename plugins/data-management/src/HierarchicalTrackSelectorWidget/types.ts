import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

export interface TreeTrackNode {
  name: string
  id: string
  trackId: string
  conf: AnyConfigurationModel
  checked: boolean
  children: TreeNode[] // empty
  nestingLevel: number
  type: 'track'
}

export interface TreeCategoryNode {
  name: string
  id: string
  children: TreeNode[]
  nestingLevel: number
  type: 'category'
}

export type TreeNode = TreeTrackNode | TreeCategoryNode

export interface MinimalModel {
  filterText: string
  activeSortTrackNames: boolean
  activeSortCategories: boolean
  collapsed: Map<string | number, boolean>
  view?: {
    tracks: { configuration: AnyConfigurationModel }[]
  }
}
