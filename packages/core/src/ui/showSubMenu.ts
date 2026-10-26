import VisibilityIcon from '@mui/icons-material/Visibility'

import { subMenuIfAny } from './MenuTypes.ts'

import type { MenuItem } from './MenuTypes.ts'

/**
 * The "Show" submenu every display groups its visibility toggles under, and
 * the empty-omit that goes with it: a display whose toggles are all
 * inapplicable right now (wiggle in density mode with no cross hatches, a
 * multi-row painting with no legend) drops the row rather than opening an empty
 * submenu.
 *
 * Not exported from `ui/menuItems.ts`: the icon is a value import, and that
 * entry is the React-free one (see its header). Import this module directly —
 * `@jbrowse/core/ui/showSubMenu` — which costs one icon rather than the
 * `@jbrowse/core/ui` barrel's ~80 Material components.
 */
export function makeShowSubMenu(items: MenuItem[]): MenuItem[] {
  return subMenuIfAny({
    label: 'Show',
    icon: VisibilityIcon,
    subMenu: items,
  })
}
