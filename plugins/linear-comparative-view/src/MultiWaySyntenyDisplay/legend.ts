import {
  MAX_LEGEND_ENTRIES,
  derivedColorScale,
} from '@jbrowse/core/util/legendCandidates'
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
import type { CategoricalField } from '@jbrowse/core/util/categoricalField'
import type { AttributeRange } from '@jbrowse/synteny-core'

function onScreen(hits: readonly GlyphHit[], [from, to]: Span) {
  return hits.filter(
    h => Math.max(h.x1, h.x2) >= from && Math.min(h.x1, h.x2) <= to,
  )
}

/**
 * The key for a `jexl:` gene color over the hits one lane packed: one row per
 * distinct fill, named by the leftmost feature carrying it. A callback has no
 * field behind it, so this reads the vocabulary back off the drawing; a
 * gene-symbol table drawn with `jexl:randomColor(feature.name)` puts one color
 * on one symbol, and the row names the symbol.
 *
 * Deduped by color as well as by name, because a row IS a color: two names on
 * one color are indistinguishable on screen. A feature with no name
 * contributes nothing — an id-labeled row names a color after a string the
 * reader has never seen.
 *
 * `span` is in the hits' own px, which the cull that packed them is half a
 * screen wider than: a key naming a gene the reader would have to pan to reach
 * does not describe this picture.
 */
export function laneColorKey(
  hits: readonly GlyphHit[],
  span: Span,
): CategoricalEntry[] {
  const colors = new Set<string>()
  const labels = new Set<string>()
  const items: CategoricalEntry[] = []
  const drawn = onScreen(hits, span).sort(
    (a, b) => Math.min(a.x1, a.x2) - Math.min(b.x1, b.x2),
  )
  for (const { feature, fill } of drawn) {
    const name: unknown = feature.get('name')
    const color = fill?.css
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
 * The key a painting field derives from one lane's hits on screen: every value
 * a mark was filed under, through the union every channel-backed key runs
 */
export function laneFieldKey(
  hits: readonly GlyphHit[],
  span: Span,
  field: CategoricalField,
): ColorScale[] {
  return derivedColorScale(
    [onScreen(hits, span)],
    drawn => ({
      candidates: drawn.flatMap(({ fill }) =>
        fill?.key === undefined
          ? []
          : [{ rowIndex: 0, value: fill.key, color: fill.packed }],
      ),
      rowPaintsCandidateColor: () => true,
    }),
    { id: 'genes', field, maxItems: MAX_LEGEND_ENTRIES },
  ).map(scale => ({ ...scale, title: `Gene ${field.field}` }))
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
