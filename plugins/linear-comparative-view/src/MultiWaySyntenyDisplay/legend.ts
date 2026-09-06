import { MAX_LEGEND_ENTRIES } from '@jbrowse/core/util/legendCandidates'
import { categoricalColor, colorSchemes } from '@jbrowse/synteny-core'

import type { Span } from './layoutMultiWay.ts'
import type { GlyphHit } from './multiwayRenderTypes.ts'
import type { MultiWayRibbonColorBy } from './ribbonColorModes.ts'
import type { LegendItem, LegendMark } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { CategoricalMode } from '@jbrowse/synteny-core'

/**
 * The key for the colors one lane draws, over the hits that lane packed: one
 * row per distinct color, named by the leftmost feature carrying it.
 *
 * The display itself encodes nothing in a glyph's color — the `color` slot
 * does, per feature — so this reads the vocabulary back off the drawing rather
 * than claiming one. A gene-symbol ortholog table drawn with
 * `jexl:randomColor(feature.name)` puts one color on one symbol, and the row
 * names the symbol; a flat color puts every gene in one row and the caller
 * (`legendIsReadable`) drops the key as saying nothing.
 *
 * Deduped by color as well as by name, because a row IS a color: two names on
 * one color are indistinguishable on screen, and a key that listed both would
 * point the reader at a difference the picture does not draw. A feature with no
 * name contributes nothing — an id-labeled row names a color after a string the
 * reader has never seen.
 *
 * `visible` is in the hits' own px, which the cull that packed them is half a
 * screen wider than: a key naming a gene the reader would have to pan to reach
 * is a key that does not describe this picture.
 */
export function laneColorKey(
  hits: readonly GlyphHit[],
  [from, to]: Span,
  colorOf: (feature: Feature) => string | undefined,
): LegendItem[] {
  const colors = new Set<string>()
  const labels = new Set<string>()
  const items: LegendItem[] = []
  const drawn = hits
    .filter(h => Math.max(h.x1, h.x2) >= from && Math.min(h.x1, h.x2) <= to)
    .sort((a, b) => Math.min(a.x1, a.x2) - Math.min(b.x1, b.x2))
  for (const { feature } of drawn) {
    const name: unknown = feature.get('name')
    const color = colorOf(feature)
    if (
      typeof name === 'string' &&
      name !== '' &&
      color !== undefined &&
      !labels.has(name) &&
      !colors.has(color)
    ) {
      labels.add(name)
      colors.add(color)
      items.push({ label: name, color })
    }
  }
  return items
}

/**
 * What the ribbons' own colors mean: a fixed pair in `strand` mode, one row per
 * label in an `attribute:` mode, and nothing otherwise: `default` paints one
 * color, which keys nothing, and `identity` paints a continuous ramp, which a
 * row list cannot state — that one wants the gradient bar Hi-C and LD draw, and
 * does not have it here.
 *
 * Drawn as the connector they are rather than as a filled square, so a reader
 * looking for the color can tell which of the two things on screen — a glyph or
 * a ribbon — the row is about.
 */
export function ribbonColorKey(
  colorBy: MultiWayRibbonColorBy,
  drawCurves: boolean,
  labels?: CategoricalMode,
): LegendItem[] {
  const mark: LegendMark = drawCurves ? 'curve' : 'line'
  if (colorBy === 'strand') {
    return [
      {
        label: 'Same orientation as lane above',
        color: colorSchemes.strand.posColor,
        mark,
      },
      {
        label: 'Inverted vs lane above',
        color: colorSchemes.strand.negColor,
        mark,
      },
    ]
  }
  if (labels) {
    const shown = labels.labels.slice(0, MAX_LEGEND_ENTRIES)
    const rest = labels.labels.length - shown.length
    return [
      ...shown.map(label => ({
        label,
        color: categoricalColor(labels, label),
        mark,
      })),
      ...(rest > 0 ? [{ label: `+${rest} more` }] : []),
    ]
  }
  return []
}
