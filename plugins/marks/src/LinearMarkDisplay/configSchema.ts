import {
  ConfigurationSchema,
  requirementProblems,
} from '@jbrowse/core/configuration'
import { GLYPH_NAMES } from '@jbrowse/core/util/glyphNames'
import {
  normalizeChannel,
  paintedScale,
} from '@jbrowse/display-kit/colorConfigSchema'
import { densityTierConfigSchemaFields } from '@jbrowse/display-kit/densityTierConfigSchemaFields'
import { facetConfigSchema } from '@jbrowse/display-kit/facetConfigSchema'
import { jexlFilterConfigSchemaFields } from '@jbrowse/display-kit/jexlFilterConfigSchemaFields'
import { regionTooLargeConfigSchemaFields } from '@jbrowse/display-kit/regionTooLargeConfigSchemaFields'
import { trackHeightConfigSchemaFields } from '@jbrowse/display-kit/trackHeightConfigSchemaFields'
import { types } from '@jbrowse/mobx-state-tree'
import { scalesSchema, valueScaleSchema } from '@jbrowse/wiggle-core'

import { markColorSchema } from './markColorConfigSchema.ts'
import { markTransformStep } from './markTransformConfigSchema.ts'
import {
  DEFAULT_MARK_SHAPE,
  DEFAULT_MARK_SOURCE,
  MARK_SHAPES,
  MARK_SOURCES,
} from './markVocabulary.ts'
import { readsValue } from './shapeSpecs.ts'

import type { MarkProblem, MarkSnapshot } from './markProblems.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

export { MARK_SHAPES, MARK_SOURCES } from './markVocabulary.ts'
export type { MarkShapeName, MarkSourceName } from './markVocabulary.ts'

export const DEFAULT_POINT_DIAMETER_PX = 4

const MARK_GLYPH_SCALES = ['none', 'categorical'] as const
export type MarkGlyphScale = (typeof MARK_GLYPH_SCALES)[number]

/** The scale a mark's glyph is drawn through: `categorical` beside a `field`. */
export function markGlyphScale(glyph: {
  scale: MarkGlyphScale | undefined
  field: string
}) {
  return paintedScale(glyph, 'categorical')
}

const markGlyphSchema = ConfigurationSchema(
  'MarkGlyph',
  {
    /**
     * #slot marks.encoding.glyph.value
     * `disc`, `triangle` or `diamond`, or a jexl callback over `feature`
     * returning one, for a point mark whose glyph is not a scale. Writing
     * `glyph: 'triangle'` directly on the encoding lands here.
     */
    value: {
      type: 'stringEnum',
      model: types.enumeration('GlyphName', [...GLYPH_NAMES]),
      defaultValue: 'disc',
      description: 'disc, triangle, diamond or jexl callback',
      contextVariable: ['feature'],
    },
    /**
     * #slot marks.encoding.glyph.field
     * The feature field a categorical scale reads — or a jexl expression over
     * `feature`, which is slower per feature and so the opt-in.
     */
    field: {
      type: 'featureField',
      defaultValue: '',
      description: 'feature field, or jexl expression',
    },
    /**
     * #slot marks.encoding.glyph.scale
     * `categorical` hands a glyph from `range` to each distinct value of
     * `field`; `none` draws `value`. Unset beside a `field`, it is
     * `categorical`.
     */
    scale: {
      type: 'maybeStringEnum',
      model: types.enumeration('MarkGlyphScale', [...MARK_GLYPH_SCALES]),
      description: 'none or categorical; unset follows field',
    },
    /**
     * #slot marks.encoding.glyph.range
     * The glyph names a categorical scale hands out, in order. Empty is
     * `disc`, `triangle`, `diamond`.
     */
    range: {
      type: 'stringEnumArray',
      model: types.enumeration('GlyphName', [...GLYPH_NAMES]),
      defaultValue: [],
      description: 'glyph names, in order',
    },
    /**
     * #slot marks.encoding.glyph.domain
     * The values in legend order, walking `range` from the first entry;
     * left empty, each value derives its glyph from itself, so every region
     * agrees.
     */
    domain: {
      type: 'stringArray',
      defaultValue: [],
      description: 'category order',
    },
  },
  {
    shorthand: 'value',
    closed: true,
    preProcessSnapshot: snap => normalizeChannel(snap, 'glyph'),
  },
)

const markEncodingSchema = ConfigurationSchema(
  'MarkEncoding',
  {
    /**
     * #slot marks.encoding.x
     * The feature field, or jexl expression over `feature`, giving the mark's
     * left edge in bp.
     */
    x: {
      type: 'featureField',
      defaultValue: 'start',
      description: 'left edge field',
    },
    /**
     * #slot marks.encoding.x2
     * The feature field, or jexl expression, giving the mark's right edge in bp.
     */
    x2: {
      type: 'featureField',
      defaultValue: 'end',
      description: 'right edge field',
    },
    /**
     * #slot marks.encoding.y
     * The feature field, or jexl expression over `feature`, plotted on the score
     * axis. A feature whose value is not a finite number is skipped. Empty for
     * a mark with no value, such as a span; a bar or point naming none draws
     * nothing, and the track's corner notice says so. The scale it is read
     * through is the display's `scales.y`.
     */
    y: {
      type: 'featureField',
      defaultValue: '',
      description: 'value field, or jexl expression',
    },
    /**
     * #slot marks.encoding.row
     * The feature field, or jexl expression, naming the band the mark stands in,
     * an integer from 0; a feature with nothing there sits on band 0. Empty
     * reads the field a `pileup` step wrote, this mark's own or the display's,
     * and puts every mark on one band across the whole plot where neither
     * packs.
     */
    row: {
      type: 'featureField',
      defaultValue: '',
      description: 'band field; empty follows a pileup step',
    },
    /**
     * #slot marks.encoding.color
     * The mark's colour: a CSS colour, a jexl callback returning one, or an
     * object binding a field to a categorical or continuous scale. A scale is
     * what the legend describes.
     */
    color: markColorSchema,
    /**
     * #slot marks.encoding.glyph
     * For a point mark: `disc`, `triangle` or `diamond`, a jexl callback over
     * `feature` returning one, or an object binding a field to a categorical
     * scale over those names. A scale is what the legend describes.
     */
    glyph: markGlyphSchema,
  },
  { closed: true },
)

// The one thing a load refuses of a `marks` list: a shape the display does
// not draw, which the slot's own enumeration refuses on a write too, named
// here because its message would otherwise be the enumeration's. Everything
// that depends on two slots at once is reported, by the mark schema's
// `requires` and by `markProblems`, since the config editor writes one slot at
// a time and a load that refused the state between two valid marks would drop
// the track (ADR-133).
function checkMarks(snap: Record<string, unknown>) {
  const { marks } = snap
  if (!Array.isArray(marks)) {
    return snap
  }
  const shapeless = (marks as { shape?: string }[]).flatMap((mark, i) =>
    mark.shape === undefined ||
    (MARK_SHAPES as readonly string[]).includes(mark.shape)
      ? []
      : [`mark ${i} names shape "${mark.shape}"`],
  )
  if (shapeless.length > 0) {
    throw new Error(
      `LinearMarkDisplay: ${shapeless.join(', ')}, and a shape is ${MARK_SHAPES.join(', ')}`,
    )
  }
  return snap
}

const markSchema = ConfigurationSchema(
  'Mark',
  {
    /**
     * #slot marks.shape
     * `bar` stands between `origin` and `y`; `point` is a glyph at `y`; `span`
     * is a band across the whole plot from `x` to `x2`.
     */
    shape: {
      type: 'stringEnum',
      model: types.enumeration('MarkShape', [...MARK_SHAPES]),
      defaultValue: DEFAULT_MARK_SHAPE,
      description: 'bar, point or span',
    },
    /**
     * #slot marks.encoding
     * Which feature fields feed the mark's channels. Every channel has a
     * default, so `{}` draws a bar from `start` to `end` with no value.
     */
    encoding: markEncodingSchema,
    /**
     * #slot marks.transform
     * Steps over the region's features before this mark encodes them, in
     * order, after the display's own `transform`, and over each section alone
     * under a facet. A `bin` then an `aggregate` grouped by `start` and `end`
     * is a density: `count` per bin, plotted as `y`.
     */
    transform: types.array(markTransformStep),
    /**
     * #slot marks.source
     * Where this mark draws from once the byte gate refuses the features.
     * `features` is off — the mark draws nothing past the budget. `density`
     * draws the adapter's `densityAdapter` sidecar in the banner's place, one
     * bar per sidecar bin over this mark's own y axis, and needs no transform:
     * the sidecar has already binned. With no density mark the banner stands.
     */
    source: {
      type: 'stringEnum',
      model: types.enumeration('MarkSource', [...MARK_SOURCES]),
      defaultValue: DEFAULT_MARK_SOURCE,
      description: 'features, or density past the fetch budget',
    },
    /**
     * #slot marks.minBpPerPx
     * The mark draws only when the view is at least this zoomed out, in bp per
     * px. 0 sets no bound. With `maxBpPerPx` on another mark, one config shows
     * a density zoomed out and the features zoomed in.
     */
    minBpPerPx: {
      type: 'number',
      defaultValue: 0,
      description: 'draw only at or above this bp/px',
    },
    /**
     * #slot marks.maxBpPerPx
     * The mark draws only when the view is zoomed in past this, in bp per px.
     * 0 sets no bound.
     */
    maxBpPerPx: {
      type: 'number',
      defaultValue: 0,
      description: 'draw only below this bp/px',
    },
  },
  {
    closed: true,
    requires: [
      {
        id: 'mark-without-value',
        when: { shape: MARK_SHAPES.filter(readsValue) },
        slots: ['encoding.y'],
        message:
          'a bar or a point stands at a value and names no y field to plot, so it draws nothing',
      },
    ],
  },
)

/**
 * What each mark's own slots say together that it cannot mean, read off the
 * mark schema's `requires`. The generated JSON schema states the same entries,
 * so an editor and `jbrowse validate` report them from the one declaration,
 * where a file refuses them as errors.
 */
export function markRequirementProblems(
  marks: readonly MarkSnapshot[],
): MarkProblem[] {
  return marks.flatMap((mark, i) =>
    requirementProblems(markSchema, mark).map(
      ({ id, slot, message }): MarkProblem => ({
        rule: id,
        level: 'error',
        mark: i,
        slot,
        message,
      }),
    ),
  )
}

/**
 * #config LinearMarkDisplay
 * #category display
 * A grammar of graphics over a feature, alignments or variant track: a list of
 * marks — bars, points or spans — each with an encoding naming which feature
 * fields feed its channels and a transform list run before it. One fetch per
 * region evaluates every encoding in the worker; the marks draw in order over
 * one score axis.
 *
 * #example
 * A BED score column as bars, coloured by strand, with the key on screen,
 * and a per-10 kb count in its place once the view is wider than 100 bp
 * per px:
 * ```js
 * {
 *   type: 'FeatureTrack',
 *   trackId: 'scores',
 *   name: 'Scores',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'BedTabixAdapter', uri: 'https://example.com/scores.bed.gz' },
 *   displays: [
 *     {
 *       type: 'LinearMarkDisplay',
 *       displayId: 'scores-LinearMarkDisplay',
 *       marks: [
 *         {
 *           shape: 'bar',
 *           encoding: { y: 'score', color: { field: 'strand', scale: 'categorical' } },
 *           maxBpPerPx: 100,
 *         },
 *         {
 *           shape: 'bar',
 *           transform: [
 *             { type: 'bin', step: 10000 },
 *             { type: 'aggregate', groupby: ['start', 'end'], ops: [{ op: 'count' }] },
 *           ],
 *           encoding: { y: 'count' },
 *           minBpPerPx: 100,
 *         },
 *       ],
 *     },
 *   ],
 * }
 * ```
 */
export function configSchemaFactory() {
  return ConfigurationSchema(
    'LinearMarkDisplay',
    {
      ...trackHeightConfigSchemaFields({ defaultHeight: 150 }),
      ...regionTooLargeConfigSchemaFields,
      ...densityTierConfigSchemaFields,
      /**
       * #slot marks
       * The marks to draw, in order — a later one paints over an earlier one.
       * Each is a `shape` and an `encoding`.
       */
      marks: types.array(markSchema),
      /**
       * #slot transform
       * Steps over the region's features before the facet splits them and
       * before any mark's own, after `jexlFilters`: where a field the facet
       * reads is made, such as a formula lifting a read's tag.
       */
      transform: types.array(markTransformStep),
      /**
       * #slot facet
       * One band of rows per value of a field, split after `transform` and
       * before any mark's own steps: `"HP"`, or `{ field, domain }` with the
       * order the bands stack in.
       */
      facet: facetConfigSchema,
      /**
       * #slot scales
       * The scales the marks are read through, owned by the display rather
       * than by a mark: `y` alone, and every mark's `encoding.y` shares it.
       * The same object the wiggle family declares, with this display's own
       * scale types — no symlog, which `valueToYPxScaled` does not place —
       * and with the guides the scale owns: `rules`, its reference lines,
       * and `title`, the caption beside its axis.
       */
      scales: scalesSchema(
        valueScaleSchema({
          types: ['linear', 'log'],
          autoscale: {
            modes: ['local', 'localsd', 'localpercentile'],
            default: 'local',
          },
          rules: true,
          title: true,
        }),
      ),
      /**
       * #slot origin
       * The value bars grow from. The axis widens to include it whenever a
       * bar mark is drawn.
       */
      origin: {
        type: 'number',
        defaultValue: 0,
        description: 'baseline value for bars',
      },
      /**
       * #slot minWidthPx
       * Narrowest a bar or span is painted, in px, grown off its start edge.
       */
      minWidthPx: {
        type: 'number',
        defaultValue: 1,
        description: 'minimum bar/span width in px',
        advanced: true,
      },
      /**
       * #slot scatterPointSize
       * Diameter in px of point marks.
       */
      scatterPointSize: {
        type: 'number',
        defaultValue: DEFAULT_POINT_DIAMETER_PX,
        description: 'point diameter in px',
      },
      /**
       * #slot minimalTicks
       * Draw only the min/max y-axis ticks.
       */
      minimalTicks: {
        type: 'boolean',
        defaultValue: false,
        description: 'Draw only the min/max Y-axis ticks',
        advanced: true,
      },
      /**
       * #slot displayCrossHatches
       * Rule the plot with horizontal cross hatches at the tick positions —
       * the config form of the score menu's "Show cross hatches".
       */
      displayCrossHatches: {
        type: 'boolean',
        defaultValue: false,
        description: 'rule the plot at the tick positions',
      },
      /**
       * #slot showLegend
       * Draw the colour key for every mark whose colour is a scale. Defaults to
       * on.
       */
      showLegend: {
        type: 'boolean',
        defaultValue: true,
        description: 'draw the colour key',
      },
      ...jexlFilterConfigSchemaFields,
    },
    {
      explicitlyTyped: true,
      explicitIdentifier: 'displayId',
      preProcessSnapshot: checkMarks,
    },
  )
}

export type LinearMarkDisplayConfigModel = ReturnType<
  typeof configSchemaFactory
>
export type LinearMarkDisplayConfig = Instance<LinearMarkDisplayConfigModel>
export type MarkConfig = Instance<typeof markSchema>
export type { MarkTransformStepConfig } from './markTransformConfigSchema.ts'
