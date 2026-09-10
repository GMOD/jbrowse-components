import type { MenuItem } from './MenuTypes.ts'

/**
 * The trailing control a menu row draws, resolved at the point of drawing.
 *
 * `endAdornment` is an element the builder already made — synteny's and
 * wiggle's colour swatches — so the row hands it straight through.
 *
 * Lives in one place rather than at each of the four render sites, because the
 * "does any row have one?" predicate and the rendering have to agree — a row
 * that draws an adornment the column-reservation pass didn't count is a
 * misaligned menu, not a crash.
 */
export function menuItemAdornment(item: MenuItem) {
  return 'endAdornment' in item ? item.endAdornment : undefined
}

/**
 * Whether this row draws something in the shared trailing column — the question
 * `getMenuColumnFlags` asks to decide whether to reserve that column on every
 * row of the menu.
 *
 * A `type: 'custom'` row renders its own content edge to edge and never reaches
 * `menuItemAdornment`, so it cannot draw in that column however it is declared.
 */
export function hasMenuItemAdornment(item: MenuItem) {
  if (item.type === 'custom') {
    return false
  }
  return 'endAdornment' in item && !!item.endAdornment
}
