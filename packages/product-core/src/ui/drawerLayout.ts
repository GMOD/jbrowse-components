/**
 * CSS `grid-template-columns` for a main content area with an optional drawer
 * widget on the left or right. Shared by the app shell (`App.tsx`) and the
 * embedded views so the drawer positioning stays identical across products.
 *
 * The `[main]`/`[drawer]` line names let a child opt into a column explicitly
 * (e.g. app-core's app container); consumers that place children by DOM order
 * can ignore them.
 */
export function drawerGridTemplateColumns({
  drawerVisible,
  drawerPosition,
  drawerWidth,
}: {
  drawerVisible: boolean
  drawerPosition: string
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
