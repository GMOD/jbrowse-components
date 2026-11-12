import type { TreeSidebarMixinModel } from './TreeSidebarMixin.ts'
import type { PositionedHierarchyNode } from './tree/hierarchy.ts'
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
 * row type must extend it, and a field the sidebar draws carried under the
 * wrong name is a compile error rather than a blank label.
 */
export interface Row {
  /** Identity: the React key, and what the tree's leaves are matched against. */
  name: string
  /** Displayed instead of `name` when the adapter config supplied one. */
  label?: string
  /** The row's own color, an attribute the file gave it. */
  color?: string
  /**
   * The row's resolved color (`resolvedRowColors`), which the label bar
   * draws and the arrangement dialog's swatch edits.
   */
  rowColor?: string
  /** Grouping key, where rows are gathered under a heading. */
  group?: string
}

/** What the dendrogram itself reads: a name to match. */
export type TreeRow = Pick<Row, 'name'>

/**
 * What the sidebar's label half draws — `SvgRowLabels`, its on-screen wrapper
 * `RowLabelsOverlay`, and `SvgTreeSidebar`.
 */
export type LabelledRow = Pick<Row, 'name' | 'label' | 'rowColor'>

/**
 * One `rows.annotations` column as the label half draws it: a row's color by
 * its name, a row with none leaving a gap.
 */
export type RowAnnotationColumn = ReadonlyMap<string, string>

/**
 * What the sidebar, its hints and its chip read off a display composing
 * `TreeSidebarMixin`: the mixin's members, the ones a double may leave out
 * optional, and the height and scroll every host takes from
 * `TrackHeightMixin`.
 */
export interface TreeSidebarModel
  extends
    IStateTreeNode,
    Pick<
      TreeSidebarMixinModel,
      | 'treeAreaWidth'
      | 'rowsTopOffset'
      | 'rowFocusLineHeight'
      | 'showTree'
      | 'drawnRows'
      | 'rowBands'
      | 'treelessBandCount'
      | 'rowNarrowingClears'
      | 'setTreeCanvasRef'
      | 'setMouseoverCanvasRef'
      | 'setHoveredTreeNode'
      | 'setTreeAreaWidth'
      | 'setRowFocus'
      | 'showAllRows'
    >,
    Partial<
      Pick<
        TreeSidebarMixinModel,
        | 'hierarchy'
        | 'root'
        | 'rowTreeProvenance'
        | 'rowAnnotationColors'
        | 'rowColumnLabels'
        | 'treeOnFinerRows'
        | 'finerTreeHint'
        | 'rowFocus'
        | 'rowNarrowingHint'
        | 'hoveredTreeNode'
        | 'spatialIndex'
      >
    > {
  height: number
  scrollTop?: number
  setScrollTop: (scrollTop: number) => void
}

/**
 * What the tree's canvas autorun reads: the display node itself, since
 * `setupTreeDrawingAutorun` hands it to `addDisposer`, `isAlive`,
 * `getContainingView` and `getPaletteHost` (never `IAnyStateTreeNode`, which
 * is `any` and would check none of the rest), narrowed to the mixin's members
 * the drawing reads and the resolved `effectiveRowHeight`
 * (agent-docs/reference/ROW_HEIGHT_AND_FIT).
 */
export interface TreeDrawingModel
  extends
    IStateTreeNode,
    Pick<
      TreeSidebarMixinModel,
      'treeAreaWidth' | 'rowsTopOffset' | 'drawnRows'
    >,
    Partial<
      Pick<
        TreeSidebarMixinModel,
        'treeCanvas' | 'mouseoverCanvas' | 'hierarchy' | 'hoveredTreeNode'
      >
    > {
  height: number
  scrollTop?: number
  effectiveRowHeight: number
  isMinimized?: boolean
}
