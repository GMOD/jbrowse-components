/**
 * @module
 * The read side of the promotable pin: given a display, which of its promotable
 * slots its track menu actually offers a pin for.
 *
 * This exists because the two halves of the feature are declared in different
 * places and nothing joins them. `promotable: true` is a **schema** fact that
 * travels down `baseConfiguration` to every subclass; the pin is a **menu** fact,
 * built by whichever `trackMenuItems()` happens to construct a row for that slot.
 * A display that inherits the flag and curates its own menu therefore ends up
 * with a promotable slot that has no pin anywhere — and since a promoted default
 * is keyed by *display type*, no other display's pin can write its key either, so
 * the slot resolves to `promotedBase` forever unless a track customizes it.
 *
 * Nothing throws, nothing renders differently, and the config docs go on
 * advertising the setting as having a session-wide default. The state was tracked
 * by hand in `agent-docs/reference/DISPLAY_TYPE_DEFAULTS.md` and drifted twice
 * before this was written — once gaining a row for a slot that had been deleted,
 * once missing a slot that had been added.
 *
 * `products/jbrowse-web/src/tests/PromotablePinCoverage.test.ts` is the guard: it
 * opens one display of every type that declares a promotable slot and holds the
 * result against a baseline.
 */
import { promotableSlotNames } from '../configuration/util.ts'

import type { ResolvableDisplay } from '../configuration/promotableResolve.ts'
import type { MenuItem } from './MenuTypes.ts'

/**
 * Every promotable slot some row of `items` carries a pin for, submenus
 * included.
 *
 * Reads `defaultForAll.control.slot` and nothing else. A raw `endAdornment` is
 * deliberately not counted: it is an arbitrary element (synteny's colour
 * swatch), so it cannot say which slot it promotes, and a pin built by hand
 * rather than through `promotableToggleItem`/`promotableRadioItem` is a thing to
 * find, not to accept.
 */
export function pinnedSlots(items: MenuItem[]): Set<string> {
  const found = new Set<string>()
  const walk = (list: MenuItem[]) => {
    for (const item of list) {
      if ('defaultForAll' in item && item.defaultForAll) {
        found.add(item.defaultForAll.control.slot)
      }
      if ('subMenu' in item) {
        walk(item.subMenu)
      }
    }
  }
  walk(items)
  return found
}

/**
 * A display's promotable slots that its own track menu offers no pin for,
 * sorted. Empty is the healthy answer.
 *
 * Takes the built menu rather than calling `trackMenuItems()` itself, because
 * what a menu contains depends on the display's current state — a row can be
 * gated on a rendering type (wiggle line width), on a parent toggle (the sashimi
 * options), or on data having arrived. A caller that wants the whole surface has
 * to drive the display into the states that reveal it, and that is a decision
 * this function should not make silently.
 */
export function promotableSlotsWithoutPin(
  display: ResolvableDisplay,
  menuItems: MenuItem[],
): string[] {
  const pinned = pinnedSlots(menuItems)
  return [...promotableSlotNames(display.configuration)]
    .filter(slot => !pinned.has(slot))
    .sort((a, b) => a.localeCompare(b))
}
