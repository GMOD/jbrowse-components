// Width of the sidebar resize handle, sitting at left: treeAreaWidth.
export const TREE_RESIZE_HANDLE_WIDTH = 4

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
