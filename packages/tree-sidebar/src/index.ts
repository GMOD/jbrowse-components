export type { TreeSpatialIndex } from './spatialIndex.ts'
export { default as TreeSidebar } from './TreeSidebar.tsx'
export { DisplayCrosshairs } from './DisplayCrosshairs.tsx'
export {
  SIDEBAR_HINT_LINE_PX,
  treeIsShowing,
  treeSidebarOffset,
  treeSidebarRightEdge,
} from './treeSidebarGeometry.ts'
export { SvgRowLabels } from './SvgRowLabels.tsx'
export { SvgRowColumnLabels } from './SvgRowColumnLabels.tsx'
export { rowLabelsCarryText } from './rowLabelsBoxWidth.ts'
export { RowLabelsOverlay } from './RowLabelsOverlay.tsx'
export { RowsPanel } from './RowsPanel.tsx'
export type { RowsPanelModel } from './RowsPanel.tsx'
export {
  FILLED_ROW_SEPARATOR_OPACITY,
  MIN_SEPARATOR_ROW_PX,
  RowSeparatorLines,
} from './RowSeparatorLines.tsx'
export { StaleTreeHint } from './StaleTreeHint.tsx'
export { RowFocusHint } from './RowFocusHint.tsx'
export { SidebarHintChip } from './SidebarHintChip.tsx'
export {
  clusterProvenanceFromRegions,
  describeClusterProvenance,
} from './clusterProvenance.ts'
export type {
  ClusterProvenance,
  ClusterProvenanceRegion,
} from './clusterProvenance.ts'
export { SvgTreePath } from './SvgTreePath.tsx'
export { SvgTreeSidebar } from './SvgTreeSidebar.tsx'
export { sidebarPanelWidth, svgSidebarWidth } from './svgSidebarWidth.ts'
export type { SvgSidebarProps } from './svgSidebarWidth.ts'
export { setupTreeDrawingAutorun } from './treeDrawingAutorun.ts'
export { setupRunClusteringAutorun } from './runClusteringAutorun.ts'
export { setupRowSortAutorun } from './rowSortAutorun.ts'
export { setupTreeSidebarAutoruns } from './setupTreeSidebarAutoruns.ts'
export type { RowSortSpec } from './rowSortAutorun.ts'
export {
  loadedRegionIndexAt,
  orderRowsByValueAt,
  sortRowsAtColumn,
} from './rowSortColumn.ts'
export type { LoadedRegionSpan } from './rowSortColumn.ts'
export {
  treeOfLeaves,
  buildTree,
  clusteredCladeLayout,
  getLeafNames,
  keptRows,
  parseClusterOrder,
  treeDescribesRows,
} from './clusterUtils.ts'
export { narrowRows } from './narrowRows.ts'
export type { RowNarrowing } from './narrowRows.ts'
export { ROW_COLOR_SCALE_ID } from './rowColorScale.ts'
export type {
  RowColorKeyInputs,
  RowColorScaleSetting,
  RowColorSetting,
} from './rowColorScale.ts'
export { rowColorChoiceLabel } from './rowColorChoice.ts'
export type { RowColorSnapshot } from './rowColorChoice.ts'
export type {
  RowAlias,
  RowBand,
  RowBanding,
  RowParent,
  RowParentOf,
} from './arrangeRows.ts'
export { applyClusterRun } from './applyClusterRun.ts'
export { renameNewickLeaves, writeNewick } from './writeNewick.ts'
export type { ClusterRunModel } from './applyClusterRun.ts'
export { generateClusterRScript, matrixToTsv } from './clusterRScript.ts'
export { MIN_CLUSTER_ROWS, clusterMatrix } from './clusterMatrix.ts'
// `ClusterMatrix` is part of the dialog's public shape (`fetchMatrix` returns
// one), so it has to be nameable by the plugins that implement it.
export type { ClusterMatrix, NumericRow } from './clusterMatrix.ts'
export type { RpcMethodCaller } from './rpcMethodCaller.ts'
export { TreeSidebarMixin, orderOver } from './TreeSidebarMixin.ts'
export type { ClusterRun } from './TreeSidebarMixin.ts'
export {
  clusteringMenuItem,
  resetRowOrderMenuItems,
  showRowLabelsMenuItem,
  showRowSeparatorsMenuItem,
  sortRowsHereMenuItem,
  treeSidebarShowMenuItems,
} from './treeMenuItems.ts'
export { rowOrderMenuItems } from './rowArrangementMenuItem.ts'
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
export { clusterLayout } from './hierarchy.ts'
export type { HierarchyNode, PositionedHierarchyNode } from './hierarchy.ts'
export type {
  ClusterHierarchyNode,
  ClusterNodeData,
  HoveredTreeNode,
  RowAnnotationColumn,
  RowLabelSource,
  RowSource,
  TreeDrawingModel,
  TreeSidebarModel,
  TreeSource,
} from './types.ts'
export { default as ClusterDialog } from './clusterDialog/ClusterDialog.tsx'
export type {
  ClusterDialogProps,
  ClusterRunArgs,
} from './clusterDialog/types.ts'
