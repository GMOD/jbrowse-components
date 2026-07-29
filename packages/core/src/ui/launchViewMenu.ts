import type { MenuItem, SubMenuItem } from './MenuTypes.ts'

const LAUNCH_VIEW_LABEL = 'Launch view'

// Several independent plugins (dotplot-view, linear-comparative-view, …) each
// contribute one "open another view for this feature" context-menu item via
// their own `Core-extendPluggableElement` callback. Call this instead of
// pushing a top-level item so the contributions land in a single "Launch
// view" submenu regardless of which plugin's extension runs first.
//
// The rubberband menu has its own seam for the same job —
// `rubberBandLaunchMenuItems()` on the linear genome view — because there the
// grouping is the model's, not each contributor's, to do.
export function pushLaunchViewMenuItem(items: MenuItem[], item: MenuItem) {
  const existing = items.find(
    (i): i is SubMenuItem =>
      i.type === 'subMenu' && i.label === LAUNCH_VIEW_LABEL,
  )
  if (existing) {
    existing.subMenu.push(item)
  } else {
    items.push({
      label: LAUNCH_VIEW_LABEL,
      type: 'subMenu',
      subMenu: [item],
    })
  }
}
