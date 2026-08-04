import type { ClusterProvenance } from './clusterProvenance.ts'
import type { HierarchyNode, PositionedHierarchyNode } from './hierarchy.ts'
import type { NewickNode } from './newick.ts'
import type Flatbush from '@jbrowse/core/util/flatbush'

export type ClusterNodeData = NewickNode

export type ClusterHierarchyNode = PositionedHierarchyNode<ClusterNodeData>

export interface HoveredTreeNode {
  node: ClusterHierarchyNode
  descendantNames: string[]
}

export interface TreeSource {
  name: string
  color?: string
}

// One row as the sidebar's label half draws it: `name` is the identity (React
// key, and what the tree's leaves are matched against), `label` the displayed
// string when the adapter config supplied one, `labelColor` the identity tint
// that carries the row when it is too short for text. Shared by `SvgRowLabels`,
// its on-screen wrapper `RowLabelsOverlay`, and `SvgTreeSidebar`, which each
// used to redeclare it.
export interface RowLabelSource {
  name: string
  label?: string
  labelColor?: string
}

export interface TreeSidebarModel {
  totalHeight?: number
  hierarchy?: ClusterHierarchyNode
  // The parsed (and subtree-filtered) tree, from TreeSidebarMixin. `hierarchy`
  // is this *positioned*, and is undefined both when there is no tree and when
  // the tree no longer describes the rows — having the unpositioned one lets
  // `StaleTreeHint` tell those apart.
  root?: HierarchyNode<ClusterNodeData>
  // What the tree was computed from, when this app computed it. Undefined for
  // a supplied phylogeny (maf's `.nh`) and for a session that predates the
  // field — `ClusterProvenanceHint` simply renders nothing in both cases.
  clusterProvenance?: ClusterProvenance
  treeAreaWidth: number
  height: number
  lineZoneHeight?: number
  scrollTop?: number
  showTree: boolean
  sources?: TreeSource[]
  subtreeFilter?: string[]
  hoveredTreeNode?: HoveredTreeNode
  spatialIndex?: {
    index: Flatbush
    nodes: ClusterHierarchyNode[]
  }
  setTreeCanvasRef: (ref: HTMLCanvasElement | null) => void
  setMouseoverCanvasRef: (ref: HTMLCanvasElement | null) => void
  setHoveredTreeNode: (node?: HoveredTreeNode) => void
  setTreeAreaWidth: (width: number) => void
  setSubtreeFilter: (names?: string[]) => void
  // optional: displays with a virtual scroll reset it when the subtree filter
  // re-lays-out the tree, so it shows from the top instead of a stale offset
  setScrollTop?: (scrollTop: number) => void
}

export interface TreeDrawingModel {
  treeCanvas?: HTMLCanvasElement | null
  mouseoverCanvas?: HTMLCanvasElement | null
  hierarchy?: ClusterHierarchyNode
  treeAreaWidth: number
  height: number
  lineZoneHeight?: number
  scrollTop?: number
  // Resolved px row height, never a fit-to-height sentinel. Every row display
  // spells the raw setting `rowHeight` (0 = fit to display height) and the
  // resolved value `effectiveRowHeight`, which is the one to pass here — see
  // agent-docs/reference/ROW_HEIGHT_AND_FIT.
  effectiveRowHeight: number
  totalHeight?: number
  hoveredTreeNode?: HoveredTreeNode
  sources?: TreeSource[]
  isMinimized?: boolean
}
