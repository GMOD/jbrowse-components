import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

export interface TreeTrackNode {
  name: string
  id: string
  trackId: string
  superTrackId: string
  conf: AnyConfigurationModel
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

export interface TreeSuperTrackNode {
  name: string
  id: string
  superTrackId: string
  children: TreeNode[]
  nestingLevel: number
  type: 'supertrack'
}

export type TreeNode = TreeTrackNode | TreeCategoryNode | TreeSuperTrackNode

export interface MinimalModel {
  filterText: string
  activeSortTrackNames: boolean
  activeSortCategories: boolean
}
