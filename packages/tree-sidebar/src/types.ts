import type { ClusterProvenance } from './clusterProvenance.ts'
import type { HierarchyNode, PositionedHierarchyNode } from './hierarchy.ts'
import type { TreeSpatialIndex } from './spatialIndex.ts'
import type { NewickNode } from '@gmod/newick'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

export type ClusterNodeData = NewickNode

export type ClusterHierarchyNode = PositionedHierarchyNode<ClusterNodeData>

export interface HoveredTreeNode {
  node: ClusterHierarchyNode
  descendantNames: string[]
}

/**
 * One row of a display with a dendrogram sidebar, as everything in this package
 * draws it. `TreeSidebarMixin`'s generic is bound to this, so a display's own
 * row type must extend it.
 *
 * The bound is what keeps the sidebar honest. It used to be `{ name: string }`
 * — the weakest possible — and the four displays that compose the mixin each
 * declared their own row type against it. `MafSource` came out carrying its tint
 * under `color`, which the sidebar does not read, so handing `sources` straight
 * over type-checked and painted nothing; MAF caught that and bridged it with a
 * `labelSources` computed, which is the shape this replaces. A field the sidebar
 * draws belongs here, where carrying it under the wrong name is a compile error
 * rather than a blank stripe someone has to notice.
 *
 * Every member but `name` is optional, so widening this does not break a
 * display that has nothing to put in it — what it breaks is a display that
 * *does* and forgot to say so.
 */
export interface RowSource {
  /** Identity: the React key, and what the tree's leaves are matched against. */
  name: string
  /** Displayed instead of `name` when the adapter config supplied one. */
  label?: string
  /** What the row's own content is painted in, where the display paints per row. */
  color?: string
  /**
   * The identity tint the sidebar carries the row with when it is too short for
   * text. Separate from `color` because a display that spends `color` on its
   * painting (multi-row features' itemRgb ramp, multi-wiggle's density mode)
   * would otherwise have a group hue overwrite the encoding it is read by.
   */
  labelColor?: string
  /** Grouping key, where rows are gathered under a heading. */
  group?: string
}

/** What the dendrogram itself reads: a name to match, a color to draw. */
export type TreeSource = Pick<RowSource, 'name' | 'color'>

/**
 * What the sidebar's label half draws — `SvgRowLabels`, its on-screen wrapper
 * `RowLabelsOverlay`, and `SvgTreeSidebar`, which each used to redeclare it.
 */
export type RowLabelSource = Pick<RowSource, 'name' | 'label' | 'labelColor'>

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
  // Px the display reserves above its rows, so the sidebar starts where the
  // rows do. It is a *total*, not any one band: the multi-sample variant
  // displays stack a variant lane and a connector-line zone and hand over the
  // sum (`rowsTopOffset`), which is why this is not named for either of them.
  rowsTopOffset?: number
  scrollTop?: number
  showTree: boolean
  sources: TreeSource[]
  subtreeFilter?: string[]
  hoveredTreeNode?: HoveredTreeNode
  // exactly what `buildSpatialIndex` returns, named rather than restructured:
  // the array and the index into it are only meaningful together
  spatialIndex?: TreeSpatialIndex
  setTreeCanvasRef: (ref: HTMLCanvasElement | null) => void
  setMouseoverCanvasRef: (ref: HTMLCanvasElement | null) => void
  setHoveredTreeNode: (node?: HoveredTreeNode) => void
  setTreeAreaWidth: (width: number) => void
  setSubtreeFilter: (names?: string[]) => void
  // Every host composes TrackHeightMixin, which is where this comes from.
  // Displays with a virtual scroll reset it when the subtree filter
  // re-lays-out the tree, so it shows from the top instead of a stale offset.
  setScrollTop: (scrollTop: number) => void
}

// `IStateTreeNode`, because `setupTreeDrawingAutorun` hands it to
// `addDisposer`, `isAlive`, `getContainingView` and `getPaletteHost`: it is the
// display node itself, narrowed to what the drawing reads. Never
// `IAnyStateTreeNode`, which is `any` and would check none of the rest.
export interface TreeDrawingModel extends IStateTreeNode {
  treeCanvas?: HTMLCanvasElement | null
  mouseoverCanvas?: HTMLCanvasElement | null
  hierarchy?: ClusterHierarchyNode
  treeAreaWidth: number
  height: number
  rowsTopOffset?: number
  scrollTop?: number
  // Resolved px row height, never a fit-to-height sentinel. Every row display
  // spells the raw setting `rowHeight` (0 = fit to display height) and the
  // resolved value `effectiveRowHeight`, which is the one to pass here — see
  // agent-docs/reference/ROW_HEIGHT_AND_FIT.
  effectiveRowHeight: number
  totalHeight?: number
  hoveredTreeNode?: HoveredTreeNode
  sources: TreeSource[]
  isMinimized?: boolean
}
