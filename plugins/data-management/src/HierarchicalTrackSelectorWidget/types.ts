import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

// A resolved track plus where the tree put it. Extends the source rather than
// restating four of its fields, so a field added to TrackNodeSource reaches the
// row without a second declaration and a copy in generateHierarchy — which is
// three places to remember, and the adornment found all three.
export interface TreeTrackNode extends TrackNodeSource {
  // unique per-node key for React/DOM/test ids, group-prefixed e.g.
  // "Tracks,myTrackId"; NOT the track identity. Use trackId to toggle a track
  id: string
  // the underlying track identity, used for show/hide/toggle
  trackId: string
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

// a category the user has taken out of the default expanded state. Collapsed
// hides the children under an accordion header; folder replaces the whole
// subtree with a single row that opens a faceted selector
export type CategoryMode = 'collapsed' | 'folder'

export type ResolvedCategoryMode = CategoryMode | 'expanded'

// one rendered row of the virtualized tree, with the presentation and layout
// the model resolved for it. Tracks always carry mode 'expanded'. `accordion`
// is what makes the row taller, so the component must not re-derive it
export interface TreeRow {
  item: TreeNode
  mode: ResolvedCategoryMode
  accordion: boolean
  height: number
  top: number
}

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
