import VisibilityIcon from '@mui/icons-material/Visibility'

import type { MenuItem } from '@jbrowse/core/ui'

// Shared "Show" submenu: every wiggle-family display (wiggle, multi-wiggle,
// manhattan) groups its visibility toggles here, and all of them drop the whole
// submenu when nothing applies (e.g. density mode with no cross hatches). Kept
// as one helper so they can't drift on the label/icon or the empty-omit
// behavior.
export function makeShowSubMenu(items: MenuItem[]): MenuItem[] {
  return items.length
    ? [{ label: 'Show', icon: VisibilityIcon, subMenu: items }]
    : []
}
