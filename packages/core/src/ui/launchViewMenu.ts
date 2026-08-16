import type { MenuItem, SubMenuItem } from './MenuTypes.ts'

export const LAUNCH_VIEW_LABEL = 'Launch view'

// Add `item` under the `label` submenu of `items`, creating that submenu the
// first time. What makes several plugins' contributions collect in one place
// instead of each becoming its own top-level row, whatever order they ran in.
export function pushIntoSubMenu(
  items: MenuItem[],
  label: string,
  item: MenuItem,
) {
  const existing = items.find(
    (i): i is SubMenuItem => i.type === 'subMenu' && i.label === label,
  )
  if (existing) {
    existing.subMenu.push(item)
  } else {
    items.push({ label, type: 'subMenu', subMenu: [item] })
  }
}

// Several independent plugins (dotplot-view, linear-comparative-view, …) each
// contribute one "open another view for this feature" context-menu item. Call
// this instead of pushing a top-level item so the contributions land in a
// single "Launch view" submenu regardless of which plugin's extension runs
// first. The `group` option on `addViewMenuItems`/`addDisplayMenuItems` does the
// same thing for a contributor registered that way, and is the shorter road to
// it.
//
// The rubberband menu has its own seam for the same job —
// `rubberBandLaunchMenuItems()` on the linear genome view — because there the
// grouping is the model's, not each contributor's, to do.
export function pushLaunchViewMenuItem(items: MenuItem[], item: MenuItem) {
  pushIntoSubMenu(items, LAUNCH_VIEW_LABEL, item)
}
