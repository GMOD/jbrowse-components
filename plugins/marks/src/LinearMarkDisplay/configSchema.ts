import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { DEFAULT_MARK_COLOR } from '@jbrowse/core/util/markEncoding'
import { trackHeightConfigSchemaFields } from '@jbrowse/display-kit/trackHeightConfigSchemaFields'
import { types } from '@jbrowse/mobx-state-tree'
import { scoreAxisConfigSchemaFields } from '@jbrowse/wiggle-core'

import type { Instance } from '@jbrowse/mobx-state-tree'

export const MARK_SHAPES = ['bar', 'point', 'span'] as const
export type MarkShapeName = (typeof MARK_SHAPES)[number]

export const DEFAULT_POINT_DIAMETER_PX = 4

// `color: 'red'`, `color: 'jexl:…'` and `glyph: 'triangle'` are the unscaled
// arm, spelled as the bare string every other such slot takes; the object
// form binds a field to a scale. One sub-schema holds both, so the string is
// lifted into `value`. A `domain` written as numbers (a ramp's `[0, 100]`) is
// carried as strings, which is the one array slot type the schema has; the
// display parses the numbers back for a ramp.
function liftValue(snap: unknown) {
  const obj: Record<string, unknown> =
    typeof snap === 'string' ? { value: snap } : { ...(snap as object) }
  if (Array.isArray(obj.domain)) {
    obj.domain = obj.domain.map(String)
  }
  return obj
}

const markColorSchema = ConfigurationSchema(
  'MarkColor',
  {
    /**
     * #slot marks.encoding.color.value
     * A CSS colour, or a jexl callback over `feature` returning one, for a
     * mark whose colour is not a scale. Writing `color: 'red'` or
     * `color: 'jexl:…'` directly on the encoding lands here.
     */
    value: {
      type: 'color',
      defaultValue: DEFAULT_MARK_COLOR,
      description: 'CSS colour or jexl callback',
      contextVariable: ['feature'],
    },
    /**
     * #slot marks.encoding.color.field
     * The feature field a scale reads — or a jexl callback over `feature`,
     * which is slower per feature and so the opt-in.
     */
    field: {
      type: 'string',
      defaultValue: '',
      description: 'feature field, or jexl callback',
    },
    /**
     * #slot marks.encoding.color.scale
     * How `field` becomes a colour. `categorical` hands out palette entries
     * per distinct value; `linear` and `log` read the value through `domain`
     * into `ramp`. `none` paints `value`.
     */
    scale: {
      type: 'stringEnum',
      model: types.enumeration('MarkColorScale', [
        'none',
        'categorical',
        'linear',
        'log',
      ]),
      defaultValue: 'none',
      description: 'none, categorical, linear or log',
    },
    /**
     * #slot marks.encoding.color.palette
     * The CSS colours a categorical scale hands out, in order. Empty uses the
     * built-in qualitative palette.
     */
    palette: {
      type: 'stringArray',
      defaultValue: [],
      description: 'categorical colours, in order',
    },
    /**
     * #slot marks.encoding.color.domain
     * For a categorical scale, the values in legend order, walking the
     * palette from the first entry; left empty, each value derives its
     * colour from itself, so every region agrees. For a linear or log scale, the
     * `[min, max]` the ramp spans; empty uses each region's own extremes.
     */
    domain: {
      type: 'stringArray',
      defaultValue: [],
      description: 'category order, or a ramp [min, max]',
    },
    /**
     * #slot marks.encoding.color.ramp
     * A linear or log scale's ramp: `["viridis"]`, or two or more CSS colour
     * stops spaced evenly. Empty is viridis.
     */
    ramp: {
      type: 'stringArray',
      defaultValue: [],
      description: 'viridis, or CSS colour stops',
    },
  },
  { preProcessSnapshot: liftValue },
)

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
      type: 'string',
      defaultValue: 'disc',
      description: 'disc, triangle, diamond or jexl callback',
      contextVariable: ['feature'],
    },
    /**
     * #slot marks.encoding.glyph.field
     * The feature field a categorical scale reads — or a jexl callback over
     * `feature`, which is slower per feature and so the opt-in.
     */
    field: {
      type: 'string',
      defaultValue: '',
      description: 'feature field, or jexl callback',
    },
    /**
     * #slot marks.encoding.glyph.scale
     * `categorical` hands a glyph from `range` to each distinct value of
     * `field`; `none` draws `value`.
     */
    scale: {
      type: 'stringEnum',
      model: types.enumeration('MarkGlyphScale', ['none', 'categorical']),
      defaultValue: 'none',
      description: 'none or categorical',
    },
    /**
     * #slot marks.encoding.glyph.range
     * The glyph names a categorical scale hands out, in order. Empty is
     * `disc`, `triangle`, `diamond`.
     */
    range: {
      type: 'stringArray',
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
  { preProcessSnapshot: liftValue },
)

const markEncodingSchema = ConfigurationSchema('MarkEncoding', {
  /**
   * #slot marks.encoding.x
   * The feature field, or jexl callback over `feature`, giving the mark's
   * left edge in bp.
   */
  x: {
    type: 'string',
    defaultValue: 'start',
    description: 'left edge field',
  },
  /**
   * #slot marks.encoding.x2
   * The feature field, or jexl callback, giving the mark's right edge in bp.
   */
  x2: {
    type: 'string',
    defaultValue: 'end',
    description: 'right edge field',
  },
  /**
   * #slot marks.encoding.y
   * The feature field, or jexl callback, plotted on the score axis. A feature
   * whose value is not a finite number is skipped. Empty for a mark with no
   * value, which is what a span is.
   */
  y: {
    type: 'string',
    defaultValue: '',
    description: 'value field',
  },
  /**
   * #slot marks.encoding.row
   * For a span mark: the feature field, or jexl callback, naming the band
   * the span stacks on, an integer from 0; a feature with nothing there sits
   * on band 0. Empty puts every span on one band across the whole plot.
   */
  row: {
    type: 'string',
    defaultValue: '',
    description: 'band field for spans',
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
})

export const TRANSFORM_TYPES = [
  'filter',
  'formula',
  'bin',
  'aggregate',
  'coverage',
] as const
export const AGGREGATE_OPS = ['count', 'sum', 'mean', 'min', 'max'] as const

const aggregateOpSchema = ConfigurationSchema('MarkAggregateOp', {
  /**
   * #slot marks.transform.ops.op
   * `count` needs no field; `sum`, `mean`, `min` and `max` read one.
   */
  op: {
    type: 'stringEnum',
    model: types.enumeration('MarkAggregateOpName', [...AGGREGATE_OPS]),
    defaultValue: 'count',
    description: 'count, sum, mean, min or max',
  },
  /**
   * #slot marks.transform.ops.field
   * The feature field the op reads, for every op but `count`.
   */
  field: {
    type: 'string',
    defaultValue: '',
    description: 'field the op reads',
  },
  /**
   * #slot marks.transform.ops.as
   * The output field. Empty is `count`, or `<op>_<field>`.
   */
  as: {
    type: 'string',
    defaultValue: '',
    description: 'output field',
  },
})

// `as: 'depth'` on a formula or coverage step is the one name; a bin step's
// two names are already a list. One array slot holds both spellings.
function liftAs(snap: unknown) {
  const obj = { ...(snap as Record<string, unknown>) }
  if (typeof obj.as === 'string') {
    obj.as = [obj.as]
  }
  return obj
}

const transformStepSchema = ConfigurationSchema(
  'MarkTransformStep',
  {
    /**
     * #slot marks.transform.type
     * `filter` keeps the features `expr` admits; `formula` writes `expr`'s
     * value into `as`; `bin` snaps each feature to the `step`-bp bin its
     * `field` falls in, writing the bin's edges over `start` and `end` (or
     * the two names in `as`); `aggregate` folds each `groupby` group into
     * one feature carrying `ops`; `coverage` replaces the features with
     * runs of how many overlap each stretch, in `as` (`coverage`).
     */
    type: {
      type: 'stringEnum',
      model: types.enumeration('MarkTransformType', [...TRANSFORM_TYPES]),
      defaultValue: 'filter',
      description: 'filter, formula, bin, aggregate or coverage',
    },
    /**
     * #slot marks.transform.expr
     * A jexl callback over `feature`, for a `filter` or `formula` step.
     */
    expr: {
      type: 'string',
      defaultValue: '',
      description: 'jexl callback over feature',
      contextVariable: ['feature'],
    },
    /**
     * #slot marks.transform.field
     * For a `bin` step: the field placing a feature in a bin, `start` when
     * empty.
     */
    field: {
      type: 'string',
      defaultValue: '',
      description: 'field a bin reads',
    },
    /**
     * #slot marks.transform.step
     * For a `bin` step: the bin width in bp, aligned to the genome.
     */
    step: {
      type: 'number',
      defaultValue: 10000,
      description: 'bin width in bp',
    },
    /**
     * #slot marks.transform.as
     * The field a `formula` or `coverage` step writes, or the two fields a
     * `bin` step writes its edges to. A single name may be written as a
     * string.
     */
    as: {
      type: 'stringArray',
      defaultValue: [],
      description: "output field, or a bin's two",
    },
    /**
     * #slot marks.transform.groupby
     * For an `aggregate` step: the fields whose distinct value sets make
     * the groups — `["start", "end"]` after a `bin`. Empty folds the whole
     * region into one feature.
     */
    groupby: {
      type: 'stringArray',
      defaultValue: [],
      description: 'grouping fields',
    },
    /**
     * #slot marks.transform.ops
     * For an `aggregate` step: the summaries each group carries.
     */
    ops: types.array(aggregateOpSchema),
  },
  { preProcessSnapshot: liftAs },
)

const markSchema = ConfigurationSchema('Mark', {
  /**
   * #slot marks.shape
   * `bar` stands between `origin` and `y`; `point` is a glyph at `y`; `span`
   * is a band across the whole plot from `x` to `x2`.
   */
  shape: {
    type: 'stringEnum',
    model: types.enumeration('MarkShape', [...MARK_SHAPES]),
    defaultValue: 'bar',
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
   * order, after the display's `jexlFilters`. A `bin` then an `aggregate`
   * grouped by `start` and `end` is a density: `count` per bin, plotted as
   * `y`.
   */
  transform: types.array(transformStepSchema),
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
})

/**
 * #config LinearMarkDisplay
 * #category display
 * A display whose picture is declared in config: a list of marks — bars, points
 * or spans — each with an encoding naming which feature fields feed its
 * channels. One fetch per region evaluates every encoding in the worker; the
 * marks draw in order over one score axis.
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
      /**
       * #slot marks
       * The marks to draw, in order — a later one paints over an earlier one.
       * Each is a `shape` and an `encoding`.
       */
      marks: types.array(markSchema),
      ...scoreAxisConfigSchemaFields,
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
       * #slot showLegend
       * Draw the colour key for every mark whose colour is a scale. Defaults to
       * on.
       */
      showLegend: {
        type: 'boolean',
        defaultValue: true,
        description: 'draw the colour key',
      },
      /**
       * #slot jexlFilters
       * Jexl filters every feature must pass before it is encoded, written
       * without the `jexl:` prefix.
       */
      jexlFilters: {
        type: 'stringArray',
        defaultValue: [],
        description: 'feature filters, without the jexl prefix',
      },
    },
    { explicitlyTyped: true, explicitIdentifier: 'displayId' },
  )
}

export type LinearMarkDisplayConfigModel = ReturnType<
  typeof configSchemaFactory
>
export type LinearMarkDisplayConfig = Instance<LinearMarkDisplayConfigModel>
export type MarkConfig = Instance<typeof markSchema>
export type MarkTransformStepConfig = Instance<typeof transformStepSchema>
