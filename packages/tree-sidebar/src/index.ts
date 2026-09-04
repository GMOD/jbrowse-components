// re-exported rather than dropped: the maf and canvas plugins import both from
// this package, and a plugin's imports are ABI
export { parseNewick } from '@gmod/newick'
export type { NewickNode } from '@gmod/newick'
export { buildSpatialIndex, pickTreeNode } from './spatialIndex.ts'
export type { TreeSpatialIndex } from './spatialIndex.ts'
export { default as TreeSidebar } from './TreeSidebar.tsx'
export { DisplayCrosshairs } from './DisplayCrosshairs.tsx'
export {
  treeIsShowing,
  treeSidebarOffset,
  treeSidebarRightEdge,
} from './treeSidebarGeometry.ts'
export {
  MIN_TEXT_ROW_HEIGHT,
  SvgRowLabels,
  rowLabelsCarryText,
} from './SvgRowLabels.tsx'
export { RowLabelsOverlay } from './RowLabelsOverlay.tsx'
export {
  MIN_SEPARATOR_ROW_PX,
  RowSeparatorLines,
} from './RowSeparatorLines.tsx'
export { StaleTreeHint } from './StaleTreeHint.tsx'
export { SubtreeFilterHint } from './SubtreeFilterHint.tsx'
export { focusRowGroup, focusRows } from './focusRows.ts'
export { ClusterProvenanceHint } from './ClusterProvenanceHint.tsx'
export {
  CLUSTER_PROVENANCE_MIN_OVERLAP,
  clusterProvenanceDrifted,
  clusterProvenanceFromRegions,
  clusterProvenanceLocLabel,
  clusterProvenanceOverlap,
  describeClusterProvenance,
} from './clusterProvenance.ts'
export type {
  ClusterProvenance,
  ClusterProvenanceRegion,
} from './clusterProvenance.ts'
export { SvgClusterProvenanceCaption } from './SvgClusterProvenanceCaption.tsx'
export { SvgTreePath } from './SvgTreePath.tsx'
export { SvgTreeSidebar } from './SvgTreeSidebar.tsx'
export { setupTreeDrawingAutorun } from './treeDrawingAutorun.ts'
export { setupRunClusteringAutorun } from './runClusteringAutorun.ts'
export { setupRowSortAutorun } from './rowSortAutorun.ts'
export { setupTreeSidebarAutoruns } from './setupTreeSidebarAutoruns.ts'
export type { RowSortSpec } from './rowSortAutorun.ts'
export {
  loadedRegionIndexAt,
  orderRowsByValueAt,
  regionCoversColumn,
  sortRowsAtColumn,
} from './rowSortColumn.ts'
export type { LoadedRegionSpan } from './rowSortColumn.ts'
export {
  applyLayoutOverrides,
  applySubtreeFilter,
  buildClusteredLayout,
  buildTree,
  clusteredCladeLayout,
  computeClusterHierarchy,
  filterRowsBySubtree,
  parseClusterOrder,
  parseClusterTree,
  reconcileLayout,
  treeDescribesRows,
  validateClusterOrder,
} from './clusterUtils.ts'
export { applyClusterRun } from './applyClusterRun.ts'
export type { ClusterRunModel } from './applyClusterRun.ts'
export { generateClusterRScript, matrixToTsv } from './clusterRScript.ts'
export { clusterProgressStatus } from './clusterProgressStatus.ts'
export { MIN_CLUSTER_ROWS, clusterMatrix } from './clusterMatrix.ts'
// `ClusterMatrix` is part of the dialog's public shape (`fetchMatrix` returns
// one), so it has to be nameable by the plugins that implement it.
export type { ClusterMatrix, NumericRow } from './clusterMatrix.ts'
export type { RpcMethodCaller } from './rpcMethodCaller.ts'
export { default as ClusterModeSelector } from './ClusterModeSelector.tsx'
export { default as ClusterProgress } from './ClusterProgress.tsx'
export { useClusterRun } from './useClusterRun.ts'
export { TreeSidebarMixin } from './TreeSidebarMixin.ts'
// Moved to display-kit on 2026-08-27 — right-click state is a display concern
// every plugin has, not a tree one. Re-exported so nothing importing the old
// name breaks; new code names the display-kit subpath.
export { ContextMenuMixin } from '@jbrowse/display-kit/ContextMenuMixin'
export { DisplayContextMenu } from '@jbrowse/display-kit/DisplayContextMenu'
export {
  TREE_SIDEBAR_LABEL,
  clearSubtreeFilterMenuItems,
  clusterProvenanceMenuItems,
  clusteringMenuItem,
  resetRowOrderMenuItems,
  showRowLabelsMenuItem,
  showRowSeparatorsMenuItem,
  showTreeSidebarMenuItem,
  sortRowsHereMenuItem,
  treeSidebarShowMenuItems,
  treeBranchLengthMenuItem,
} from './treeMenuItems.ts'
export {
  rowSeparatorsConfigSchemaFields,
  treeSidebarConfigSchemaFields,
} from './treeSidebarConfigSchemaFields.ts'
export { rowArrangementMenuItem } from './rowArrangementMenuItem.ts'
export { RowHeightMixin } from './rowHeight/RowHeightMixin.ts'
export { rowHeightConfigSchemaFields } from './rowHeight/rowHeightConfigSchemaFields.ts'
export { rowHeightMenuItem } from './rowHeight/rowHeightMenu.ts'
export type {
  RowHeightModel,
  RowHeightPreset,
} from './rowHeight/rowHeightMenu.ts'
export {
  extraColumns,
  moveDown,
  moveUp,
  updateRows,
} from './sourcesGridUtils.ts'
export { paletteColorsByRow } from './setColorDialog/applyColorPalette.ts'
export { compareRowValues } from './setColorDialog/useSourceSort.ts'
export { default as SetColorDialog } from './setColorDialog/SetColorDialog.tsx'
export type {
  SetColorDialogProps,
  TreeLayoutModel,
} from './setColorDialog/SetColorDialog.tsx'
export type { ColorColumn } from './setColorDialog/SourceGrid.tsx'
// Displays reach the layout through `computeClusterHierarchy` (clusterUtils);
// the raw `clusterLayout` primitive stays public only for SVG-export tests.
// hierarchy/leaves/links/sum and the y-assignment/traversal helpers remain
// internal to the layout and draw code (kept in hierarchy.ts, not re-exported).
export { clusterLayout } from './hierarchy.ts'
export type { HierarchyNode, PositionedHierarchyNode } from './hierarchy.ts'
export type {
  ClusterHierarchyNode,
  ClusterNodeData,
  HoveredTreeNode,
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
