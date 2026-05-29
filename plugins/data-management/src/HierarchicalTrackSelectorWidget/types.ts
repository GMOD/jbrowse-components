import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

export interface TreeTrackNode {
  name: string
  // unique per-node key for React/DOM/test ids, group-prefixed e.g.
  // "Tracks,myTrackId"; NOT the track identity. Use trackId to toggle a track
  id: string
  // the underlying track identity, used for show/hide/toggle
  trackId: string
  conf: AnyConfigurationModel
  description: string
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
}
