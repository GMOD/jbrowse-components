export type { TreeSpatialIndex } from './tree/spatialIndex.ts'
export { default as TreeSidebar } from './sidebar/TreeSidebar.tsx'
export {
  SIDEBAR_HINT_LINE_PX,
  treeIsShowing,
  treeSidebarOffset,
  treeSidebarRightEdge,
} from './sidebar/treeSidebarGeometry.ts'
export { SvgRowLabels } from './sidebar/SvgRowLabels.tsx'
export { SvgRowColumnLabels } from './sidebar/SvgRowColumnLabels.tsx'
export { rowLabelsCarryText } from './sidebar/rowLabelsBoxWidth.ts'
export { RowLabelsOverlay } from './sidebar/RowLabelsOverlay.tsx'
export { RowsPanel } from './sidebar/RowsPanel.tsx'
export type { RowsPanelModel } from './sidebar/RowsPanel.tsx'
export {
  FILLED_ROW_SEPARATOR_OPACITY,
  MIN_SEPARATOR_ROW_PX,
  RowSeparatorLines,
} from './sidebar/RowSeparatorLines.tsx'
export { StaleTreeHint } from './sidebar/StaleTreeHint.tsx'
export { RowFocusHint } from './sidebar/RowFocusHint.tsx'
export { SidebarHintChip } from './sidebar/SidebarHintChip.tsx'
export {
  clusterProvenanceFromRegions,
  describeClusterProvenance,
} from './clustering/clusterProvenance.ts'
export type {
  ClusterProvenance,
  ClusterProvenanceRegion,
} from './clustering/clusterProvenance.ts'
export { SvgTreePath } from './sidebar/SvgTreePath.tsx'
export { SvgTreeSidebar } from './sidebar/SvgTreeSidebar.tsx'
export {
  sidebarPanelWidth,
  svgSidebarWidth,
} from './sidebar/svgSidebarWidth.ts'
export type { SvgSidebarProps } from './sidebar/svgSidebarWidth.ts'
export { setupTreeDrawingAutorun } from './tree/treeDrawingAutorun.ts'
export { setupRunClusteringAutorun } from './clustering/runClusteringAutorun.ts'
export { setupRowSortAutorun } from './rows/rowSort.ts'
export { setupTreeSidebarAutoruns } from './setupTreeSidebarAutoruns.ts'
export type { RowSortSpec } from './rows/rowSort.ts'
export {
  loadedRegionIndexAt,
  orderRowsByValueAt,
  sortRowsAtColumn,
} from './rows/rowSort.ts'
export type { LoadedRegionSpan } from './rows/rowSort.ts'
export { treeOfLeaves, buildTree } from './tree/newick.ts'
export {
  clusteredCladeLayout,
  parseClusterOrder,
} from './clustering/applyClusterRun.ts'
export { getLeafNames, treeDescribesRows } from './tree/hierarchy.ts'
export { keptRows } from './rows/narrowRows.ts'
export { narrowRows } from './rows/narrowRows.ts'
export type { RowNarrowing } from './rows/narrowRows.ts'
export { ROW_COLOR_SCALE_ID } from './color/rowColorKey.ts'
export type { RowColorKeyInputs } from './color/rowColorKey.ts'
export type {
  RowColorScaleSetting,
  RowColorSetting,
} from './color/rowColors.ts'
export { rowColorChoiceLabel } from './color/rowColorChoice.ts'
export type { RowColorEdits, RowColorSnapshot } from './color/rowColorChoice.ts'
export type {
  RowAnnotationDeal,
  RowAnnotationDrawn,
  RowAnnotationSetting,
} from './color/rowAnnotations.ts'
export type { RowAlias, RowParent, RowParentOf } from './rows/arrangeRows.ts'
export type { RowBand, RowBanding } from './rows/bandRows.ts'
export { applyClusterRun } from './clustering/applyClusterRun.ts'
export { renameNewickLeaves, writeNewick } from './tree/newick.ts'
export type { ClusterRunModel } from './clustering/applyClusterRun.ts'
export {
  generateClusterRScript,
  matrixToTsv,
} from './clustering/clusterRScript.ts'
export { MIN_CLUSTER_ROWS, clusterMatrix } from './clustering/clusterMatrix.ts'
// `ClusterMatrix` is part of the dialog's public shape (`fetchMatrix` returns
// one), so it has to be nameable by the plugins that implement it.
export type { ClusterMatrix, NumericRow } from './clustering/clusterMatrix.ts'
export type { RpcMethodCaller } from './clustering/rpcMethodCaller.ts'
export { TreeSidebarMixin, orderOver } from './TreeSidebarMixin.ts'
export type { ClusterRun, TreeSidebarMixinModel } from './TreeSidebarMixin.ts'
export {
  clusteringMenuItem,
  resetRowOrderMenuItems,
  showRowLabelsMenuItem,
  showRowSeparatorsMenuItem,
  sortRowsHereMenuItem,
  treeSidebarShowMenuItems,
} from './menus/treeMenuItems.ts'
export { rowOrderMenuItems } from './menus/rowArrangementMenuItem.ts'
export { RowHeightMixin } from './rowHeight/RowHeightMixin.ts'
export { rowHeightMenuItem } from './rowHeight/rowHeightMenu.ts'
export type {
  RowHeightModel,
  RowHeightPreset,
} from './rowHeight/rowHeightMenu.ts'
export type {
  RowArrangementDialogProps,
  RowArrangementModel,
} from './rowArrangementDialog/RowArrangementDialog.tsx'
// Displays reach the layout through `TreeSidebarMixin`'s `hierarchy`;
// `clusterLayout` stays public only for SVG-export tests.
export { clusterLayout } from './tree/hierarchy.ts'
export type {
  HierarchyNode,
  PositionedHierarchyNode,
} from './tree/hierarchy.ts'
export type {
  ClusterHierarchyNode,
  ClusterNodeData,
  HoveredTreeNode,
  RowAnnotationColumn,
  LabelledRow,
  Row,
  TreeDrawingModel,
  TreeSidebarModel,
  TreeRow,
} from './types.ts'
export { default as ClusterDialog } from './clustering/dialog/ClusterDialog.tsx'
export type {
  ClusterDialogProps,
  ClusterRunArgs,
} from './clustering/dialog/types.ts'
