import { DefaultForAllAdornment } from './DefaultForAllAdornment.tsx'

import type { MenuItem } from './MenuTypes.ts'

/**
 * The trailing control a menu row draws, resolved at the point of drawing.
 *
 * Two fields feed it and they are not equivalent. `endAdornment` is an element
 * the builder already made — the escape hatch, for content nothing else can
 * describe. `defaultForAll` is a *description* of the "default for all tracks of
 * this type" pin, and turning it into `DefaultForAllAdornment` here is the whole
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
  return 'defaultForAll' in item && item.defaultForAll ? (
    <DefaultForAllAdornment
      control={item.defaultForAll.control}
      label={item.defaultForAll.label}
    />
  ) : undefined
}

export function hasMenuItemAdornment(item: MenuItem) {
  return (
    ('endAdornment' in item && !!item.endAdornment) ||
    ('defaultForAll' in item && !!item.defaultForAll)
  )
}
