import { checkboxItem } from './toggleMenuItems.ts'

import type { MenuItem } from './MenuTypes.ts'
import type { PinnableRowOptions } from './toggleMenuItems.ts'

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
 * The `showLegend` **config slots** stay per display: their `promotedBase`
 * values legitimately differ (a Hi-C color scale is off by default, a variant
 * genotype key on), and their descriptions describe genuinely different legends.
 * What they now share is being *promotable* — pass `opts.pin` and the row gains
 * the pin over the legend's current state: a click applies it to every open
 * track of this display type and offers it as the display-type default, and a
 * filled pin (the state already is the default) clears it. Every
 * display whose legend is backed by a config slot passes one, and gets it from
 * `LegendMixin`'s `showLegendDisplayTypeDefault` rather than calling
 * `makePin` itself: the slot is the per-display half, the accessors over
 * it are not.
 *
 * `pin` is optional because two callers have no slot to promote: the Manhattan
 * plot's LD legend and `LinearBasicDisplay`'s color key are a volatile and a
 * per-legend `dismissed` flag respectively, neither of which is config at all.
 *
 * `synteny-core`'s color-by legend has no toggle at all: it comes up with the
 * modes that have a key and is dismissed from its own close button.
 */
/** #menuBuilder showLegendCheckboxItem | the shared "Show legend" checkbox */
export function showLegendCheckboxItem(
  checked: boolean,
  onToggle: () => void,
  opts?: PinnableRowOptions,
): MenuItem {
  return checkboxItem('Show legend', checked, onToggle, opts)
}
