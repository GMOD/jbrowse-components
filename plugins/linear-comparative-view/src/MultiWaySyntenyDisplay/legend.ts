import {
  MAX_LEGEND_ENTRIES,
  derivedColorScale,
} from '@jbrowse/core/util/legendCandidates'
import { getFeatureName } from '@jbrowse/plugin-canvas'
import {
  colorByScales,
  colorByShortLabel,
  getColorBySwatch,
  resolveCategoricalMode,
  resolveNumericMode,
  strandLevels,
} from '@jbrowse/synteny-core'

import type { Span } from './layoutMultiWay.ts'
import type { GlyphHit } from './multiwayRenderTypes.ts'
import type { CategoricalEntry, ColorScale } from '@jbrowse/core/ui/colorScale'
import type { CategoricalField } from '@jbrowse/core/util/categoricalField'
import type { AttributeRange, SyntenyColorPaint } from '@jbrowse/synteny-core'

function onScreen(hits: readonly GlyphHit[], [from, to]: Span) {
  return hits.filter(
    h => Math.max(h.x1, h.x2) >= from && Math.min(h.x1, h.x2) <= to,
  )
}

/**
 * One row per distinct fill, named by its leftmost feature. `span` is in the
 * hits' own px.
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
    const name = getFeatureName(feature)
    const color = fill?.css
    if (
      name !== undefined &&
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
 * The gene key over every lane's hits, or over the anchor lane's alone where
 * every lane's is too long to list. Across 44 strains each strain's private
 * genes take a row and blow the bound, while a haplotype's are the genes worth
 * keying.
 */
export function stackGeneKey(
  hitsByRow: readonly (readonly GlyphHit[])[],
  keyOf: (hits: GlyphHit[]) => ColorScale[],
) {
  const every = keyOf(hitsByRow.flat())
  if (every.length > 0 && !every.some(isSummarized)) {
    return every
  }
  const anchor = keyOf([...(hitsByRow[0] ?? [])])
  return anchor.length > 0 ? anchor : every
}

function isSummarized(scale: ColorScale) {
  return scale.kind === 'categorical' && scale.summarize !== undefined
}

export function laneFieldKey(
  hits: readonly GlyphHit[],
  span: Span,
  field: CategoricalField,
  title = `Gene ${field.field}`,
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
  ).map(scale => ({ ...scale, title }))
}

export function ribbonColorKey(
  field: string,
  attributeRanges: Record<string, AttributeRange> = {},
  {
    hideUnlabelled = false,
    slotColor,
    names,
    against = 'lane above',
    paint = {},
  }: RibbonKeyOptions = {},
): CategoricalEntry[] {
  if (field === 'strand') {
    const [same, inverted] = strandLevels(paint, names)
    return [
      {
        value: 'same',
        label: same!.label ?? `Same orientation as ${against}`,
        color: same!.color,
      },
      {
        value: 'inverted',
        label: inverted!.label ?? `Inverted vs ${against}`,
        color: inverted!.color,
      },
    ]
  }
  if (!resolveCategoricalMode(field, attributeRanges)) {
    return []
  }
  const swatch = getColorBySwatch(field, {
    attributeRanges,
    hideUnlabelled,
    missingColor: slotColor,
    names,
  })
  return swatch?.kind === 'chips'
    ? swatch.chips.map(({ color, label, values, missing }) => ({
        value: color === undefined ? '' : (values?.[0] ?? label),
        ...(values ? { values } : {}),
        label,
        color,
        ...(missing ? { missing } : {}),
      }))
    : []
}

interface RibbonKeyOptions {
  hideUnlabelled?: boolean
  slotColor?: string
  /** `scale.names`, what the key names each domain value */
  names?: readonly string[]
  /** what each ribbon's lower lane is read against; the lane above when unset */
  against?: string
  /** what `ribbons.encoding.color.scale` declares over a field's own scale */
  paint?: SyntenyColorPaint
}

/** `title` unset keeps the ribbons' own heading; `''` draws none. */
export function ribbonColorScales(
  field: string,
  attributeRanges: Record<string, AttributeRange>,
  {
    domain,
    title,
    descending,
    ...keyOptions
  }: RibbonKeyOptions & {
    domain?: string[]
    title?: string
    /** a threshold's key lists its highest interval first */
    descending?: boolean
  } = {},
): ColorScale[] {
  const { paint, names } = keyOptions
  const numeric = resolveNumericMode(field, attributeRanges, paint)
  if (numeric && numeric.attribute in attributeRanges) {
    const label = colorByShortLabel(field)
    const [key, ...noValue] = colorByScales(field, {
      attributeRanges,
      paint,
      names,
      descending,
    })
    return [
      {
        ...key!,
        id: 'ribbons',
        title: title ?? `Ribbon ${label[0]!.toLowerCase()}${label.slice(1)}`,
      },
      ...noValue,
    ]
  }
  const textColumn = resolveCategoricalMode(field, attributeRanges)
  return [
    {
      kind: 'categorical',
      id: 'ribbons',
      title: title ?? 'Ribbon colors',
      entries: ribbonColorKey(field, attributeRanges, keyOptions),
      domain: textColumn ? domain : undefined,
    },
  ]
}
