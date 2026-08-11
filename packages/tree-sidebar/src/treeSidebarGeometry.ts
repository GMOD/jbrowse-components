// Width of the sidebar resize handle, sitting at left: treeAreaWidth.
export const TREE_RESIZE_HANDLE_WIDTH = 4

// Narrowest the gutter may be dragged. Not zero: at zero the handle is the only
// thing left of the sidebar and it would sit on the track's left edge, where
// there is nothing to say it is a control.
export const MIN_TREE_AREA_WIDTH = 10

/**
 * The width a drag may actually set, both ends of it in one place.
 *
 * The upper bound is the point: the handle is positioned at
 * `left: treeAreaWidth` **inside the display**, which renders in
 * `TrackRenderingContainer`'s `contain: strict` sandbox — so a drag that takes
 * the gutter past the view width puts the handle outside that box, where it is
 * clipped away and cannot be clicked. `treeAreaWidth` is a persisted property
 * and no menu item resets it, so the track stays all-sidebar across a reload
 * with no way back short of editing the session. The drag used to carry
 * `Math.max(10, …)` and nothing on the other side.
 *
 * Derived from the view rather than a chosen ceiling: the invariant is "the
 * control that got you here is still reachable", which is exactly the handle's
 * right edge staying on screen. `MIN_TREE_AREA_WIDTH` wins on a viewport too
 * narrow to satisfy both, since a sidebar you cannot see is the lesser problem.
 */
export function clampTreeAreaWidth(width: number, viewWidth: number) {
  return Math.max(
    MIN_TREE_AREA_WIDTH,
    Math.min(width, viewWidth - TREE_RESIZE_HANDLE_WIDTH),
  )
}

// Drawable content zone height: sidebar height minus whatever the display
// stacks above its rows. The tree canvas, hover canvas, and sidebar layout must
// agree on this, so they all derive it here rather than recomputing
// `height - rowsTopOffset`.
export function treeContentHeight(model: {
  height: number
  rowsTopOffset?: number
}) {
  return model.height - (model.rowsTopOffset ?? 0)
}

interface TreeShowingModel {
  showTree: boolean
  hierarchy?: unknown
}

interface TreeSidebarGeometryModel extends TreeShowingModel {
  treeAreaWidth: number
}

// Is a dendrogram occupying the gutter? The gate is the **positioned** tree,
// never `clusterTree`: a tree that no longer describes the rows on screen is
// deliberately not positioned (see `computeClusterHierarchy`), and for a
// display whose `sources` are regrouped downstream of `layout` that state is
// permanent rather than transient.
//
// Callable on its own because the answer decides two things that must not
// disagree — whether the tree draws, and whether the labels beside it are
// pushed right to clear it. `SvgTreeSidebar` needs both in one function, and
// spelling the condition out again for the first of them is how they would
// come apart.
export function treeIsShowing(model: TreeShowingModel) {
  return model.showTree && !!model.hierarchy
}

// Px reserved on the left for the dendrogram, or 0 when none is drawn. This is
// where the row labels (and any axis indent beside them) start, so it has to be
// the same gate `TreeSidebar` paints under.
//
// Reserving the gutter off the newick string instead pushed the labels
// `treeAreaWidth` to the right of a gutter with nothing in it — and left the
// SVG export, which reads the positioned tree, disagreeing with the screen.
export function treeSidebarOffset(model: TreeSidebarGeometryModel) {
  return treeIsShowing(model) ? model.treeAreaWidth : 0
}

// Right edge of the sidebar including its resize handle, or 0 when no tree is
// shown. Mouse guides/tooltips left of this overlap the sidebar and should hide.
export function treeSidebarRightEdge(model: TreeSidebarGeometryModel) {
  const offset = treeSidebarOffset(model)
  return offset ? offset + TREE_RESIZE_HANDLE_WIDTH : 0
}
