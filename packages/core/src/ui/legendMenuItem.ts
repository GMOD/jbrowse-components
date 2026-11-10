import { checkboxItem } from './toggleMenuItems.ts'

import type { MenuItem } from './MenuTypes.ts'
import type { SettingRowOptions } from './toggleMenuItems.ts'

/**
 * The "Show legend" checkbox, one label wherever a legend is toggled: a
 * display's "Show" submenu (`legendCheckboxItem` in
 * `@jbrowse/display-kit/LegendMixin`), the circular view's menu, and the
 * synteny and dotplot settings menus.
 *
 * The `showLegend` **config slots** stay per display: their default values
 * legitimately differ (a Hi-C color scale is off by default, a variant genotype
 * key on), and their descriptions describe genuinely different legends.
 *
 * The synteny views' settings menus write their `legend.show`; their key's
 * close button hides it for the current mode only.
 */
/** #menuBuilder showLegendCheckboxItem | the shared "Show legend" checkbox */
export function showLegendCheckboxItem(
  checked: boolean,
  onToggle: () => void,
  opts?: SettingRowOptions,
): MenuItem {
  return checkboxItem('Show legend', checked, onToggle, opts)
}
