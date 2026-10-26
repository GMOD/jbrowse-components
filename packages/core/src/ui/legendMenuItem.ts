import { checkboxItem } from './toggleMenuItems.ts'

import type { MenuItem } from './MenuTypes.ts'
import type { SettingRowOptions } from './toggleMenuItems.ts'

/**
 * The "Show legend" checkbox for a menu with no "Show" submenu, such as the
 * circular view's. Inside "Show" the row reads "Legend"
 * (`legendCheckboxItem` in `@jbrowse/display-kit/LegendMixin`).
 *
 * The `showLegend` **config slots** stay per display: their default values
 * legitimately differ (a Hi-C color scale is off by default, a variant genotype
 * key on), and their descriptions describe genuinely different legends.
 *
 * The synteny views' settings menus carry the same "Show legend" row, writing
 * their `legend.show`; their key's close button hides it for the current mode
 * only.
 */
/** #menuBuilder showLegendCheckboxItem | a "Show legend" checkbox outside a "Show" submenu */
export function showLegendCheckboxItem(
  checked: boolean,
  onToggle: () => void,
  opts?: SettingRowOptions,
): MenuItem {
  return checkboxItem('Show legend', checked, onToggle, opts)
}
