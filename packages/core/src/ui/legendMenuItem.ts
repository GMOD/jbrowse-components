import { promotableToggleItem } from './promotableMenuItems.ts'
import { checkboxItem } from './toggleMenuItems.ts'

import type { Pin } from '../configuration/promotableDefaults.ts'
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
 * The `showLegend` **config slots** stay per display: their `promotedBase`
 * values legitimately differ (a Hi-C color scale is off by default, a variant
 * genotype key on), and their descriptions describe genuinely different legends.
 * What they now share is being *promotable* — pass `opts.pin` and the row gains
 * the pin that makes the current state this display type's session-wide
 * default. Every display whose legend is backed by a config slot passes one,
 * and gets it from `LegendMixin`'s `showLegendDisplayTypeDefault` rather than
 * calling `makePin` itself: the slot is the per-display half, the accessors
 * over it are not.
 *
 * `pin` is optional because two callers have no slot to promote: the Manhattan
 * plot's LD legend and `LinearBasicDisplay`'s color key are a volatile and a
 * per-legend `dismissed` flag respectively, neither of which is config at all.
 * They get the plain row, which is what `checkboxItem` builds either way — the
 * promotable form is that same row plus the pin, per `promotableToggleItem`.
 *
 * Deliberately not used by `synteny-core`'s "Show color legend", which sits
 * inside a "Color by..." submenu where the bare word would not say which legend.
 */
/** #menuBuilder showLegendCheckboxItem | the shared "Show legend" checkbox */
export function showLegendCheckboxItem(
  checked: boolean,
  onToggle: () => void,
  opts?: {
    helpText?: string
    disabled?: boolean
    disabledHelpText?: string
    pin?: Pin
  },
): MenuItem {
  const { pin, ...rest } = opts ?? {}
  return pin
    ? promotableToggleItem({
        label: 'Show legend',
        checked,
        onToggle,
        pin,
        ...rest,
      })
    : checkboxItem('Show legend', checked, onToggle, rest)
}
