import { radioItems } from './toggleMenuItems.ts'

import type { MenuItem } from './MenuTypes.ts'
import type React from 'react'

/**
 * Build a radio submenu from a `[value, label]` option table keyed on the
 * current `value`. Lets a display keep one option table as the single source of
 * truth for both its config enumeration and its track menu, so the two can't
 * drift. Generic over the value's string-literal union. `extraItems` are
 * appended after the radios (e.g. a related checkbox) within the same submenu.
 *
 * Every display has a submenu of this shape naming the one thing it draws —
 * wiggle's "Plot type", MAF's "Row coloring", Hi-C's "Color scheme", the arc
 * display's "Display mode". The labels stay display-specific (they name
 * genuinely different choices); the construction is shared so a hand-rolled
 * copy can't forget that a settings row keeps the menu open.
 *
 * React-free: `React.ElementType` is a type-only import, so this stays inside
 * the `menuItems.ts` purity boundary.
 */
/** #menuBuilder makeRadioSubMenu | a radio group wrapped in a submenu row */
export function makeRadioSubMenu<T extends string>(opts: {
  label: string
  icon?: React.ElementType
  value: T
  onChange: (value: T) => void
  options: readonly (readonly [T, string])[]
  /**
   * Per-option clarifiers, keyed by value. Separate from the `options` table
   * rather than a third tuple slot because that table is a display's *static*
   * source of truth — shared with its config enumeration — while the reason an
   * option is currently inert is not: it moves with zoom, with a sibling
   * setting, with what the adapter turned out to hold. `radioItems` has carried
   * `subLabel` all along; this is only the passthrough, whose absence meant a
   * caller wanting one had to hand-roll the whole submenu and lose the
   * keep-menu-open behaviour above.
   */
  subLabels?: Partial<Record<T, string>>
  extraItems?: MenuItem[]
}): MenuItem {
  const {
    label,
    icon,
    value,
    onChange,
    options,
    subLabels,
    extraItems = [],
  } = opts
  return {
    label,
    icon,
    subMenu: [
      // via radioItems so these keep the menu open like every other
      // setting row — a plot type is usually picked by trying a couple
      ...radioItems(
        options.map(([value, label]) => ({
          value,
          label,
          subLabel: subLabels?.[value],
        })),
        value,
        onChange,
      ),
      ...extraItems,
    ],
  }
}
