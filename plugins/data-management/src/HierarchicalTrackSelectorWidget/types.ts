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
  // collapse state when the user hasn't explicitly toggled this category. Used
  // for connection categories: dormant (unloaded) connections default collapsed
  // so expanding one is what loads it; a loaded connection defaults expanded.
  defaultCollapsed?: boolean
  // a connection category that has been expanded (its connection is live) but
  // whose tracks haven't arrived yet — drives a loading spinner on the label
  loading?: boolean
}

export type TreeNode = TreeTrackNode | TreeCategoryNode

// a track config plus every slot the tree reads from it, resolved once in
// model.allTracks so a filterText keystroke does no config reads
export interface TrackNodeSource {
  conf: AnyConfigurationModel
  name: string
  sortName: string
  description: string
  categories: string[]
  searchText: string
}

export interface MinimalModel {
  filteredTrackSet: Set<AnyConfigurationModel>
}
