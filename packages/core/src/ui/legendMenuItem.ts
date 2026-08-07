import { checkboxItem } from './toggleMenuItems.ts'

import type { MenuItem } from './MenuTypes.ts'

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
 * The `showLegend` **config slots** stay per display: their defaults
 * legitimately differ (a Hi-C color scale is off by default, a variant genotype
 * key on), and their descriptions describe genuinely different legends.
 *
 * Deliberately not used by `synteny-core`'s "Show color legend", which sits
 * inside a "Color by..." submenu where the bare word would not say which legend.
 */
export function showLegendCheckboxItem(
  checked: boolean,
  onToggle: () => void,
  opts?: {
    helpText?: string
    disabled?: boolean
    disabledHelpText?: string
  },
): MenuItem {
  return checkboxItem('Show legend', checked, onToggle, opts)
}
