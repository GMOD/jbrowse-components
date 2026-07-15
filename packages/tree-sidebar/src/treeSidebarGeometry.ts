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

// Right edge of the sidebar including its resize handle, or 0 when no tree is
// shown. Mouse guides/tooltips left of this overlap the sidebar and should hide.
export function treeSidebarRightEdge(model: {
  showTree: boolean
  hierarchy?: unknown
  treeAreaWidth: number
}) {
  return model.showTree && model.hierarchy
    ? model.treeAreaWidth + TREE_RESIZE_HANDLE_WIDTH
    : 0
}
