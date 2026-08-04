// Width of the sidebar resize handle, sitting at left: treeAreaWidth.
export const TREE_RESIZE_HANDLE_WIDTH = 4

// Drawable content zone height: sidebar height minus the reserved top line
// zone. The tree canvas, hover canvas, and sidebar layout must agree on this,
// so they all derive it here rather than recomputing `height - lineZoneHeight`.
export function treeContentHeight(model: {
  height: number
  lineZoneHeight?: number
}) {
  return model.height - (model.lineZoneHeight ?? 0)
}

interface TreeSidebarGeometryModel {
  showTree: boolean
  hierarchy?: unknown
  treeAreaWidth: number
}

// Px reserved on the left for the dendrogram, or 0 when none is drawn. This is
// where the row labels (and any axis indent beside them) start, so it has to be
// the same gate `TreeSidebar` paints under.
//
// That gate is the **positioned** tree, never `clusterTree`: a tree that no
// longer describes the rows on screen is deliberately not positioned (see
// `computeClusterHierarchy`), and for a display whose `sources` are regrouped
// downstream of `layout` that state is permanent rather than transient.
// Reserving the gutter off the newick string instead pushed the labels
// `treeAreaWidth` to the right of a gutter with nothing in it — and left the
// SVG export, which reads the positioned tree, disagreeing with the screen.
export function treeSidebarOffset(model: TreeSidebarGeometryModel) {
  return model.showTree && model.hierarchy ? model.treeAreaWidth : 0
}

// Right edge of the sidebar including its resize handle, or 0 when no tree is
// shown. Mouse guides/tooltips left of this overlap the sidebar and should hide.
export function treeSidebarRightEdge(model: TreeSidebarGeometryModel) {
  const offset = treeSidebarOffset(model)
  return offset ? offset + TREE_RESIZE_HANDLE_WIDTH : 0
}
