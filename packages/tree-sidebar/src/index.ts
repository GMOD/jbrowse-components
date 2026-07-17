export { buildSpatialIndex } from './spatialIndex.ts'
export { default as parseNewick } from './newick.ts'
export type { NewickNode } from './newick.ts'
export { default as TreeSidebar } from './TreeSidebar.tsx'
export { treeSidebarRightEdge } from './treeSidebarGeometry.ts'
export { SvgRowLabels } from './SvgRowLabels.tsx'
export { SvgTreePath } from './SvgTreePath.tsx'
export { SvgTreeSidebar } from './SvgTreeSidebar.tsx'
export { setupTreeDrawingAutorun } from './treeDrawingAutorun.ts'
export { setupRunClusteringAutorun } from './runClusteringAutorun.ts'
export {
  applySubtreeFilter,
  buildClusteredLayout,
  buildTree,
  computeClusterHierarchy,
  parseClusterOrder,
  parseClusterTree,
  reconcileLayout,
  validateClusterOrder,
} from './clusterUtils.ts'
export { generateClusterRScript, matrixToTsv } from './clusterRScript.ts'
export { clusterProgressStatus } from './clusterProgressStatus.ts'
export type { RpcMethodCaller } from './rpcMethodCaller.ts'
export { default as ClusterModeSelector } from './ClusterModeSelector.tsx'
export { TreeSidebarMixin } from './TreeSidebarMixin.ts'
export { treeBranchLengthMenuItem } from './treeMenuItems.ts'
export {
  extraColumns,
  moveDown,
  moveUp,
  updateRows,
} from './sourcesGridUtils.ts'
export { applyColorPalette } from './setColorDialog/applyColorPalette.ts'
export type { Colored } from './setColorDialog/applyColorPalette.ts'
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
  TreeDrawingModel,
  TreeSidebarModel,
  TreeSource,
} from './types.ts'
