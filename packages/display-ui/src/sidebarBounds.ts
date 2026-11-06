/**
 * Where a row display's sidebar sits in the display's box: left of `right`
 * (the dendrogram and its resize handle) and from `top` (where the rows start)
 * down. Whatever the display stacks above its rows runs the full width, so a
 * band there is never under the sidebar.
 */
export interface SidebarBounds {
  right: number
  top: number
}

/**
 * Whether the display-px point is under the sidebar, which takes its own
 * pointer events: every hover, click and context-menu gate on a sidebar
 * display asks this rather than comparing x alone.
 */
export function sidebarCovers(bounds: SidebarBounds, x: number, y: number) {
  return x < bounds.right && y >= bounds.top
}
