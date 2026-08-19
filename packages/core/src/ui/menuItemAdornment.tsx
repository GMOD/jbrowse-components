import { PinAdornment } from './PinAdornment.tsx'

import type { MenuItem } from './MenuTypes.ts'

/**
 * The trailing control a menu row draws, resolved at the point of drawing.
 *
 * Two fields feed it and they are not equivalent. `endAdornment` is an element
 * the builder already made — the escape hatch, for content nothing else can
 * describe. `pin` is a *description* of the "default for all tracks of
 * this type" pin, and turning it into `PinAdornment` here is the whole
 * point: the builders that set it (`promotableToggleItem`,
 * `promotableRadioItem`) are called from state models and menu modules, which
 * are eager, so a module that constructs the element instead puts MUI's
 * `ToggleButton`, `Tooltip` and two icons into every host's first paint.
 *
 * Live in one place rather than at each of the four render sites, because the
 * "does any row have one?" predicates and the rendering have to agree — a row
 * that draws a pin the column-reservation pass didn't count is a misaligned
 * menu, not a crash.
 */
export function menuItemAdornment(item: MenuItem) {
  if ('endAdornment' in item && item.endAdornment) {
    return item.endAdornment
  }
  // A disabled row is `pointer-events: none` (see `DisabledTooltip`, which
  // exists because that also swallows a Tooltip's hover), so a pin drawn in one
  // takes no click while looking exactly like a live one. Greying it is what
  // the help "?" does on such a row by not rendering at all; the pin stays
  // drawn so the trailing column keeps its alignment.
  return 'pin' in item && item.pin ? (
    <PinAdornment pin={item.pin} disabled={item.disabled} />
  ) : undefined
}

/**
 * Whether this row draws something in the shared trailing column — the question
 * `getMenuColumnFlags` asks to decide whether to reserve that column on every
 * row of the menu.
 *
 * **Not the same question as "does this row offer a pin"** (`pinnedSlots`, which
 * counts a `pin` wherever it appears). A `type: 'custom'` row renders
 * its own content edge to edge and never reaches `menuItemAdornment`, so it
 * cannot draw in that column however it is declared — counting it would reserve
 * a spacer on its siblings for a control that never appears. It still declares
 * `pin` when it draws a pin of its own (`makePromotableSizeMenu`),
 * which is what keeps the pin findable. Don't "fix" the two into agreement.
 */
export function hasMenuItemAdornment(item: MenuItem) {
  if (item.type === 'custom') {
    return false
  }
  return (
    ('endAdornment' in item && !!item.endAdornment) ||
    ('pin' in item && !!item.pin)
  )
}
