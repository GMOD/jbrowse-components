/**
 * The three schemes a paired-end arc / read cloud can be colored by, and the
 * radios the 'Arc color' submenu builds from them.
 *
 * A deliberately smaller, separately-persisted vocabulary than the read-fill
 * `ColorSchemeType`: arcs support only these three, and `'orientation'` is the
 * arc name for the read scheme's `'pairOrientation'`. Kept distinct because it
 * is a saved config value (renaming would need a migration) and the arc menu
 * carries its own richer help text. `getArcColorType`
 * (features/arcs/arcColors.ts) mirrors the matching read-fill logic.
 *
 * Here rather than beside the menu that renders it because the website's figure
 * recipes name these labels in a click path, and the node script that builds
 * them cannot load a module importing React, MUI or a lazy `.tsx`. A leaf module
 * makes the recipe import the label instead of retyping it.
 */
export const ARC_COLOR_OPTIONS = [
  {
    value: 'insertSizeAndOrientation',
    label: 'Insert size and orientation',
    subLabel: 'short=pink, then orientation, then long',
    helpText:
      'Combined SV view. A short insert always paints pink regardless of orientation — at a short insert the useful signal is just "something is here", so orientation is not worth distinguishing. Otherwise an abnormal pair orientation wins (inversion, tandem duplication), and a large insert with normal orientation paints as a long insert (the classic deletion signature). Insert-size thresholds are robust to the long tail of large inserts (median ± 3·1.4826·MAD) so the short-insert signal is not washed out by a few very large outliers.',
  },
  {
    value: 'insertSize',
    label: 'Insert size',
    subLabel: 'short=pink, long=red',
    helpText:
      'Colors only by template length: short inserts pink, long inserts red, normal grey — orientation ignored. Thresholds use a robust median ± 3·1.4826·MAD spread so a tight insert-size distribution with a few very large outliers still flags genuinely short inserts.',
  },
  {
    value: 'orientation',
    label: 'Orientation',
    subLabel: 'color by pair orientation only',
    helpText:
      'Colors only by pair orientation (LR/RL/RR/LL), ignoring insert size. Useful when you only care about inversion/duplication signatures.',
  },
] as const

export type ArcColorByType = (typeof ARC_COLOR_OPTIONS)[number]['value']

export const ARC_COLOR_TYPES = ARC_COLOR_OPTIONS.map(o => o.value)
