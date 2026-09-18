import {
  colorByScale,
  colorByShortLabel,
  colorSchemes,
  getColorBySwatch,
  resolveCategoricalMode,
  resolveContinuousMode,
} from '@jbrowse/synteny-core'

import type { Span } from './layoutMultiWay.ts'
import type { GlyphHit } from './multiwayRenderTypes.ts'
import type { CategoricalEntry, ColorScale } from '@jbrowse/core/ui/colorScale'
import type { Feature } from '@jbrowse/core/util'
import type { AttributeRange } from '@jbrowse/synteny-core'

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
): CategoricalEntry[] {
  const colors = new Set<string>()
  const labels = new Set<string>()
  const items: CategoricalEntry[] = []
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
      items.push({ value: name, label: name, color })
    }
  }
  return items
}

/**
 * What the ribbons' own colors mean as rows: a fixed pair in `strand` mode,
 * whose names are lane-relative and so this display's own; a text column's
 * mode through the one categorical swatch builder the synteny key reads,
 * including the row naming its unlabelled grey; and nothing otherwise, since
 * `default` paints one color and a measurement a ramp (`ribbonColorScale`).
 */
export function ribbonColorKey(
  field: string,
  attributeRanges: Record<string, AttributeRange> = {},
  hideUnlabelled = false,
): CategoricalEntry[] {
  if (field === 'strand') {
    return [
      {
        value: 'same',
        label: 'Same orientation as lane above',
        color: colorSchemes.strand.posColor,
      },
      {
        value: 'inverted',
        label: 'Inverted vs lane above',
        color: colorSchemes.strand.negColor,
      },
    ]
  }
  if (!resolveCategoricalMode(field, attributeRanges)) {
    return []
  }
  const swatch = getColorBySwatch(field, { attributeRanges, hideUnlabelled })
  return swatch?.kind === 'chips'
    ? swatch.chips.map(({ color, label, missing }) => ({
        value: color === undefined ? '' : label,
        label,
        color,
        ...(missing ? { missing } : {}),
      }))
    : []
}

/**
 * The ribbons' key in its own titled section, so a reader can tell a ribbon's
 * color from a glyph's: the synteny view's ramp where some ribbon carries the
 * value it paints, else `ribbonColorKey`'s rows
 */
export function ribbonColorScale(
  field: string,
  attributeRanges: Record<string, AttributeRange>,
  domain?: string[],
  hideUnlabelled = false,
): ColorScale {
  const continuous = resolveContinuousMode(field, attributeRanges)
  if (continuous && continuous.attribute in attributeRanges) {
    const label = colorByShortLabel(field)
    return {
      ...colorByScale(field, { attributeRanges }),
      id: 'ribbons',
      title: `Ribbon ${label[0]!.toLowerCase()}${label.slice(1)}`,
    }
  }
  const labels = resolveCategoricalMode(field, attributeRanges)
  return {
    kind: 'categorical',
    id: 'ribbons',
    title: 'Ribbon colors',
    entries: ribbonColorKey(field, attributeRanges, hideUnlabelled),
    // strand's pair is fixed and means what it is drawn in, so only the
    // label rows take a declared order
    domain: labels ? domain : undefined,
  }
}
