import { checkboxItem } from './toggleMenuItems.ts'

import type { MenuItem } from './MenuTypes.ts'
import type { SettingRowOptions } from './toggleMenuItems.ts'

/**
 * The "Show legend" checkbox, which seven displays build by hand — Hi-C, LD,
 * alignments, LGVSynteny, multi-wiggle, multi-row features, both multi-sample
 * variant displays and the Manhattan plot.
 *
 * Takes the value and the toggle rather than a `{ showLegend, setShowLegend }`
 * model, because the Manhattan plot's pair is named for the LD legend it draws
 * and would otherwise need an adapter object at the call site. Same argument
 * order as `checkboxItem`, which is all this adds a label to.
 *
 * The `showLegend` **config slots** stay per display: their default values
 * legitimately differ (a Hi-C color scale is off by default, a variant genotype
 * key on), and their descriptions describe genuinely different legends.
 *
 * `synteny-core`'s color-by legend has no toggle at all: it comes up with the
 * modes that have a key and is dismissed from its own close button.
 */
/** #menuBuilder showLegendCheckboxItem | the shared "Show legend" checkbox */
export function showLegendCheckboxItem(
  checked: boolean,
  onToggle: () => void,
  opts?: SettingRowOptions,
): MenuItem {
  return checkboxItem('Show legend', checked, onToggle, opts)
}
