import type { LegendItem } from '@jbrowse/core/ui'

// A source, as the color key sees it — spelled out rather than taking `Source`
// so the collapse rule stays testable without the display that produces one.
interface LegendSource {
  name: string
  label?: string
  color?: string
  labelColor?: string
  group?: string
}

/**
 * The color key for a track of several sources: one row per (group, color) pair in
 * first-appearance order, with every color resolved.
 *
 * **Collapsing rows by color makes a key possible on a cohort track.**
 * Almost always it is one row per group, since a group normally shares a color.
 * A group whose sources DISAGREE about their color splits into one row per
 * color within it, not one row per source — a store may carry a coloring finer
 * than its grouping (the per-cell PBMC store groups 4,390 cells into six
 * lineages and colors them by nine cell types, so 'T cell' is two blues). Two
 * swatches labelled 'T cell' form an accurate key; 2,436 rows for that one
 * group do not. An ungrouped source keeps a row of its own, since
 * nothing else identifies it.
 *
 * **A score gradient decides which channel the color comes from.** `color` is
 * a row's identity except where a gradient paints (density, or bars and points
 * under a declared `linear` colour): there it is the score ramp and identity
 * sits in `labelColor` — see the channel note in sourcesLogic.ts. Reading
 * `color` in density gave a grouped-but-uncolored cohort N rows that were all
 * `fallbackColor`, naming groups that were on screen in as many different
 * colors.
 *
 * **The fallback belongs to the mode as much as the channel does, and only
 * overlay/multirow have one.** There, an unset `color` really is painted in
 * `posColor` (`buildSourceRenderData`'s `defaultPosColor`), so resolving to it
 * states what is on screen. In density nothing does: identity is drawn by
 * `SvgRowLabels`, which paints a row with no `labelColor` as no swatch at all
 * rather than a default one — and `posColor` there is the score ramp, so a key
 * row in it points at a color every row is on. An uncolored density row
 * therefore gets no key entry, matching the drawing side's own choice to draw
 * nothing. Reachable whenever a density track mixes grouped subtracks (which
 * always take a group palette entry) with ungrouped ones (which take none).
 *
 * **The fallback that does apply is applied here, once**, so every item leaves
 * with a real color. The key used to carry `color?: string` all the way to the
 * renderer and resolve the fallback per swatch, which is precisely what let a
 * whole key collapse to one color without anything noticing — `legendIsReadable`
 * can only ask its distinguishability question of resolved colors.
 */
export function buildLegendItems(
  sources: LegendSource[],
  gradientPaints: boolean,
  fallbackColor: string,
): LegendItem[] {
  const seen = new Set<string>()
  const items: LegendItem[] = []
  for (const s of sources) {
    const color = gradientPaints ? s.labelColor : (s.color ?? fallbackColor)
    if (color === undefined) {
      continue
    }
    if (s.group === undefined) {
      items.push({ color, label: s.label ?? s.name })
      continue
    }
    const key = `${s.group}\0${color}`
    if (!seen.has(key)) {
      seen.add(key)
      items.push({ color, label: s.group })
    }
  }
  return items
}
