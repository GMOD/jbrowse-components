import type { MenuItem, SubMenuItem } from './MenuTypes.ts'

// The submenu every "open something for this region" contribution collects
// under, in a track menu, a view menu and the rubberband menu alike. One word,
// because half of what it now launches is not a view — a consensus dialog, the
// MAF subsequence widget, a sequence readout — and the rubberband menu has
// spelled it this way all along.
export const LAUNCH_LABEL = 'Launch'

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
// single "Launch" submenu regardless of which plugin's extension runs
// first. The `group` option on `addViewMenuItems`/`addDisplayMenuItems` does the
// same thing for a contributor registered that way, and is the shorter road to
// it.
//
// The rubberband menu has its own seam for the same job —
// `rubberBandLaunchMenuItems()` on the linear genome view — because there the
// grouping is the model's, not each contributor's, to do.
//
// Keeps its name while the label loses a word: this one is pinned by
// `abiBaseline.json`, so a published plugin bundle reads it off the host at
// module scope and a rename is `undefined` inside an already-shipped UMD.
export function pushLaunchViewMenuItem(items: MenuItem[], item: MenuItem) {
  pushIntoSubMenu(items, LAUNCH_LABEL, item)
}
