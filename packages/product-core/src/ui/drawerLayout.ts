import type { DrawerPosition } from '@jbrowse/core/util/types'

/**
 * CSS `grid-template-columns` for a main content area with an optional drawer
 * widget on the left or right. Shared by the app shell (`App.tsx`) and the
 * embedded views so the drawer positioning stays identical across products.
 *
 * The `[main]`/`[drawer]` line names are the whole interface: a host renders
 * the main container and the drawer once each, in any order, and each takes
 * its column by name. Placing them by DOM order instead means the host has to
 * render the drawer twice — once on each side, under opposite conditions — and
 * any other in-flow child auto-placed between them lands in a column meant for
 * one of the two.
 */
export function drawerGridTemplateColumns({
  drawerVisible,
  drawerPosition,
  drawerWidth,
}: {
  drawerVisible: boolean
  drawerPosition: DrawerPosition
  drawerWidth: number
}) {
  const main = '[main] minmax(0, 1fr)'
  if (drawerVisible) {
    const drawer = `[drawer] ${drawerWidth}px`
    return drawerPosition === 'right'
      ? `${main} ${drawer}`
      : `${drawer} ${main}`
  }
  return main
}
