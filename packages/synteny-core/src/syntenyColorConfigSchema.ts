import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { MEASURE_FIELD_PRESETS } from '@jbrowse/core/util/colorScale'
import {
  colorChannelOptions,
  colorDescendingSlot,
  colorDomainEndsSlots,
  colorDomainSlot,
  colorFieldSlot,
  colorInvalidSlot,
  colorLegendOptions,
  colorNamesSlot,
  colorRampSlots,
  colorRangeSlot,
  colorScaleOptions,
  colorScaleTypeSlot,
  colorTitleSlot,
  colorUnknownSlot,
} from '@jbrowse/display-kit/colorConfigSchema'

import type {
  ColorLegendSetting,
  ColorScaleSetting,
} from '@jbrowse/display-kit/colorConfigSchema'

/**
 * `scale.type` on a synteny color channel: `linear` or `threshold` names how a
 * number paints, and `ordinal` paints a declared column one color per value,
 * numbers included. Unset, a measurement takes its preset's scale and a
 * column's type is read off the fetched values, a ramp over the span for
 * numbers and a color per label for text.
 */
export const SYNTENY_COLOR_SCALES = ['linear', 'threshold', 'ordinal'] as const

export type SyntenyColorScale = (typeof SYNTENY_COLOR_SCALES)[number]

/**
 * The fields the linear synteny and dotplot views read as a mode of their own,
 * beside the measurement presets: an alignment's strand, the sequence at
 * either end, the anchor assembly's, and the track it came from.
 */
export const SYNTENY_VIEW_FIELDS = [
  'strand',
  'query',
  'target',
  'reference',
  'track',
] as const

/** A synteny color channel as its snapshot holds it. */
export interface SyntenyColorSnapshot {
  value?: string
  field?: string
  scale?: Partial<ColorScaleSetting>
  legend?: ColorLegendSetting
}

/**
 * The `scale` slots every comparative color channel declares: the synteny
 * views' `encoding.color` and the multi-way display's
 * `ribbons.encoding.color`, which paint through the same resolver.
 */
export function syntenyColorScaleSlots(scaleName: string) {
  return {
    ...colorScaleTypeSlot({
      scales: SYNTENY_COLOR_SCALES,
      scaleName,
      type: "linear runs a number along a ramp, threshold bins it at the cuts domain lists, and ordinal paints a column's values one color each, numbers included (a measurement keeps its preset); a written type wins over the values, so a text value under linear or threshold paints as missing; unset, a measurement uses its preset scale and a column linear for numbers and ordinal once a value is text",
    }),
    ...colorDomainSlot({
      domain:
        "a text column's labels that take the palette first, in order, and lead the key, the rest following sorted, strand's values (1, -1) in the order range colors them, or a threshold's cuts; a label left out takes a color no listed label or label met before it paints, the first time the view meets it, and keeps it",
    }),
    ...colorRangeSlot({
      range:
        "CSS colors a text column's labels or strand's values take, in domain order, continuing into the default palette past its end; with no domain, each label takes one of them by its name; on a ramp (identity, dnds or a numeric column), its stops, evenly spaced, in place of the field's default stops; under threshold, one per interval",
    }),
    ...colorRampSlots,
    ...colorDomainEndsSlots,
    ...colorNamesSlot,
    ...colorUnknownSlot,
    ...colorInvalidSlot,
  }
}

/** The `legend` slots every comparative color channel declares. */
export const syntenyColorLegendSlots = {
  ...colorTitleSlot,
  ...colorDescendingSlot,
}

/**
 * #config SyntenyColor
 * #category view
 * The linear synteny, dotplot and circular views' `encoding.color`, which
 * every track in the view paints with: one color for every alignment, or a
 * field of each alignment — its strand, the sequence at either end, the
 * anchor assembly's, the track it came from, a measurement through its preset
 * (`identity` and `dnds` on a ramp, `mapq` in the alignments display's bins,
 * `syntenicDepth` grey for a one-to-one ortholog and orange where genes share
 * one),
 * or a column the tracks declare in `attributeColumns`: a ramp for numbers
 * and a color per label once a value is text, unless `scale.type` says
 * otherwise (`ordinal` paints integer group ids a color each). A string is
 * the field.
 *
 * #example
 * ```js
 * { type: 'LinearSyntenyView', encoding: { color: 'strand' } }
 * ```
 * ```js
 * { type: 'DotplotView', encoding: { color: { field: 'query' } } }
 * ```
 * ```js
 * {
 *   type: 'LinearSyntenyView',
 *   encoding: {
 *     color: { field: 'identity', scale: { scheme: 'magma', domainMin: 0.9 } },
 *   },
 * }
 * ```
 * ```js
 * {
 *   type: 'LinearSyntenyView',
 *   encoding: {
 *     color: {
 *       field: 'identity',
 *       scale: { type: 'threshold', domain: [0.95, 0.99] },
 *     },
 *   },
 * }
 * ```
 * ```js
 * {
 *   type: 'LinearSyntenyView',
 *   encoding: {
 *     color: {
 *       field: 'gene_group',
 *       scale: {
 *         domain: ['A1a', 'B1'],
 *         range: ['#1b9e77', '#d95f02'],
 *         names: ['Subgenome A', 'Subgenome B'],
 *       },
 *       legend: { title: 'Gene group' },
 *     },
 *   },
 * }
 * ```
 */
export const syntenyColorConfigSchema = ConfigurationSchema(
  'SyntenyColor',
  {
    /**
     * #slot value
     * The color of every alignment while no field paints, in place of the
     * view's default scheme: the match block of a synteny ribbon, whose
     * insertions and deletions keep their colors, or a dotplot point.
     * Unset, the default scheme paints.
     */
    value: {
      type: 'maybeColor',
      description:
        'the color of every alignment in place of the default scheme',
    },
    ...colorFieldSlot({
      fieldType: 'string',
      field:
        'field to color each alignment by: strand paints forward and reverse; query and target one color per sequence on that side, reference one per chromosome of the anchor assembly across a stack, track one per overlaid track (pinned under Track colors); identity and dnds paint their preset ramps, mapq its bins and syntenicDepth grey for a one-to-one MCScan .anchors or .blocks link and orange where genes share an ortholog; any other name is a column the tracks declare in attributeColumns, a ramp over the values seen for numbers and one color per label for text (or the color a color column put beside it)',
    }),
    /**
     * #slot scale
     * How the field's values map to colors, Vega-Lite's scale object.
     */
    scale: ConfigurationSchema(
      'SyntenyColorScale',
      syntenyColorScaleSlots('SyntenyColorScaleType'),
      colorScaleOptions('encoding.color.scale'),
    ),
    /**
     * #slot legend
     * The key this channel draws.
     */
    legend: ConfigurationSchema(
      'SyntenyColorLegend',
      syntenyColorLegendSlots,
      colorLegendOptions,
    ),
  },
  colorChannelOptions('encoding.color', MEASURE_FIELD_PRESETS),
)

export type SyntenyColorConfigModel = typeof syntenyColorConfigSchema
