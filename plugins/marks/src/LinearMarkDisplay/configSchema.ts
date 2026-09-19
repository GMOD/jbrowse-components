import { ConfigurationSchema } from '@jbrowse/core/configuration'
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

import { AUTO_BIN } from './autoBin.ts'
import { markColorScale, markColorSchema } from './markColorConfigSchema.ts'
import { SHAPE_LANES } from './shapeLanes.ts'

import type { MarkColorScale } from './markColorConfigSchema.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

export { markColorScale } from './markColorConfigSchema.ts'
export type { MarkColorScale } from './markColorConfigSchema.ts'

export const MARK_SHAPES = ['bar', 'point', 'span'] as const
export type MarkShapeName = (typeof MARK_SHAPES)[number]

export const MARK_SOURCES = ['features', 'density'] as const
export type MarkSourceName = (typeof MARK_SOURCES)[number]

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
  {
    shorthand: 'value',
    closed: true,
    preProcessSnapshot: snap => normalizeChannel(snap, 'glyph'),
  },
)

const markValueScaleSchema = ConfigurationSchema(
  'MarkValueScale',
  {
    /**
     * #slot scales.y.type
     * How the axis reads its domain. The ticks, the cross-hatches and the
     * shader's placement all come from it.
     */
    type: {
      type: 'stringEnum',
      model: types.enumeration('MarkScaleType', ['linear', 'log']),
      defaultValue: 'linear',
      description: 'linear or log',
    },
    /**
     * #slot scales.y.domainMin
     * The bottom of the axis, pinning what would otherwise autoscale to the
     * loaded regions. Unset autoscales that end. The score menu's "Set
     * min/max" writes here.
     */
    domainMin: {
      type: 'maybeNumber',
      description: 'pinned bottom of the axis; unset autoscales',
    },
    /**
     * #slot scales.y.domainMax
     * The top of the axis. Unset autoscales that end.
     */
    domainMax: {
      type: 'maybeNumber',
      description: 'pinned top of the axis; unset autoscales',
    },
  },
  { closed: true },
)

const markScalesSchema = ConfigurationSchema(
  'MarkScales',
  {
    /**
     * #slot scales.y
     * The one value scale every mark's `encoding.y` is read through — the
     * plot's, not a mark's, the way a grammar of graphics gives one scale per
     * aesthetic.
     */
    y: markValueScaleSchema,
  },
  { closed: true },
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
   * The feature field, or jexl callback over `feature`, plotted on the score
   * axis. A feature whose value is not a finite number is skipped. Empty for
   * a mark with no value, such as a span; a bar or point must name one, and
   * the config is refused where it does not. The scale it is read through is
   * the display's `scales.y`.
   */
  y: {
    type: 'string',
    defaultValue: '',
    description: 'value field, or jexl callback',
    contextVariable: ['feature'],
  },
  /**
   * #slot marks.encoding.row
   * The feature field, or jexl callback, naming the band the mark stands in,
   * an integer from 0; a feature with nothing there sits on band 0. Empty
   * puts every mark on one band across the whole plot, unless this mark's
   * own `transform` holds a `stack`, whose output field it then reads.
   */
  row: {
    type: 'string',
    defaultValue: '',
    description: 'band field; empty follows a stack step',
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
  'flatten',
  'stack',
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
     * runs of how many overlap each stretch, in `as` (`coverage`);
     * `flatten` fans out an array field; `stack` writes each feature's row
     * in a greedy first-fit packing, which a `span` reading `row` draws as
     * a pileup.
     */
    type: {
      type: 'stringEnum',
      model: types.enumeration('MarkTransformType', [...TRANSFORM_TYPES]),
      defaultValue: 'filter',
      description:
        'filter, formula, bin, aggregate, coverage, flatten or stack',
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
     * For a `bin` step, the field placing a feature in a bin, `start` when
     * empty; for a `flatten` step, the array field fanned out, `subfeatures` when
     * empty.
     */
    field: {
      type: 'string',
      defaultValue: '',
      description: 'field a bin or a flatten reads',
    },
    /**
     * #slot marks.transform.step
     * For a `bin` step: the bin width in bp, aligned to the genome, or
     * `"auto"` for a width that follows the view's zoom — the target of four
     * pixels per bin, snapped up to the next 1/2/5 rung, resolved before the
     * fetch and keyed into it.
     */
    step: {
      type: 'number',
      model: types.union(types.number, types.literal(AUTO_BIN)),
      defaultValue: 10000,
      description: 'bin width in bp, or "auto" to follow the zoom',
    },
    /**
     * #slot marks.transform.as
     * The field a `formula`, `coverage` or `stack` step writes, the two
     * fields a `bin` step writes its edges to, or the field a `flatten`
     * step writes each element's index to. A single name may be written as
     * a string. A `stack` leaving it empty writes `row`, and a `formula`
     * leaving it empty writes `value`.
     */
    as: {
      type: 'stringArray',
      defaultValue: [],
      description: "output field, or a bin's two",
    },
    /**
     * #slot marks.transform.fields
     * For a `stack` step: the two fields giving the interval it packs,
     * `start` and `end` when empty.
     */
    fields: {
      type: 'stringArray',
      defaultValue: [],
      description: "a stack's [start, end] fields",
    },
    /**
     * #slot marks.transform.padding
     * For a `stack` step: bp of clearance kept between two features sharing
     * a row, so a pileup does not butt its reads together.
     */
    padding: {
      type: 'number',
      defaultValue: 0,
      description: 'bp between two features on one row',
    },
    /**
     * #slot marks.transform.keepEmpty
     * For a `flatten` step: keep a feature whose array field holds nothing,
     * which is otherwise dropped.
     */
    keepEmpty: {
      type: 'boolean',
      defaultValue: false,
      description: 'keep a feature whose array field is empty',
    },
    /**
     * #slot marks.transform.groupby
     * For an `aggregate` step: the fields whose distinct value sets make
     * the groups. Empty takes the edges a preceding `bin` in the same list
     * wrote — its `as`, or `["start", "end"]` — so binning and counting needs
     * no restatement; with no `bin` in front it folds the whole region into
     * one feature.
     */
    groupby: {
      type: 'stringArray',
      defaultValue: [],
      description: 'grouping fields; empty follows a preceding bin',
    },
    /**
     * #slot marks.transform.ops
     * For an `aggregate` step: the summaries each group carries.
     */
    ops: types.array(aggregateOpSchema),
  },
  { preProcessSnapshot: liftAs },
)

interface MarkSnapshot {
  shape?: string
  source?: string
  encoding?: Record<string, unknown> & { y?: string }
}

// Every shape places its x edges; the rest of its channels are the lanes the
// worker fills for it, `colorValue` being the ramp's spelling of `color`.
const SHAPE_CHANNELS = Object.fromEntries(
  Object.entries(SHAPE_LANES).map(([shape, lanes]) => [
    shape,
    ['x', 'x2', ...lanes.filter(l => l !== 'index' && l !== 'colorValue')],
  ]),
) as Record<string, string[]>

/** A mark's colour ramp as written, `undefined` where its colour is not one. */
function rampDomain(mark: MarkSnapshot) {
  const color = mark.encoding?.color
  if (typeof color !== 'object' || color === null) {
    return undefined
  }
  const {
    field = '',
    scale,
    ramp = [],
    domain = [],
  } = color as {
    field?: string
    scale?: MarkColorScale
    ramp?: string[]
    domain?: unknown[]
  }
  const painted = markColorScale({ scale, field, ramp })
  return painted === 'linear' || painted === 'log' ? domain : undefined
}

function pinned(entry: unknown) {
  return entry !== '' && Number.isFinite(Number(entry))
}

// What a `marks` config cannot mean, refused where the config is read rather
// than where it is drawn, so the message names the marks. A bar or point
// stands at a value: with no `y` the encoder reads 0 for every feature and the
// display draws nothing, silently.
function checkMarks(snap: Record<string, unknown>) {
  const { marks } = snap
  if (!Array.isArray(marks)) {
    return snap
  }
  const entries = marks as MarkSnapshot[]
  const valueless = entries.flatMap((mark, i) => {
    const shape = mark.shape ?? 'bar'
    return (shape === 'bar' || shape === 'point') && !mark.encoding?.y
      ? [`${i} (${shape})`]
      : []
  })
  if (valueless.length > 0) {
    throw new Error(
      `LinearMarkDisplay: a bar or point stands at a value and needs encoding.y to name the field it plots; mark${valueless.length > 1 ? 's' : ''} ${valueless.join(', ')} name${valueless.length > 1 ? '' : 's'} none`,
    )
  }
  const unread = entries.flatMap((mark, i) => {
    const shape = mark.shape ?? 'bar'
    const channels = SHAPE_CHANNELS[shape] ?? []
    const dead = Object.keys(mark.encoding ?? {})
      .filter(c => !channels.includes(c))
      .map(c => `encoding.${c}`)
    if (shape === 'span' && mark.source === 'density') {
      dead.push('source "density"')
    }
    return dead.map(c => `mark ${i} (${shape}) declares ${c}`)
  })
  if (unread.length > 0) {
    throw new Error(
      `LinearMarkDisplay: ${unread.join(', ')}, which its shape does not read`,
    )
  }
  // A ramp spans two finite numbers: `encodingOf` maps each entry through
  // `Number`, so an open end reads as 0 rather than autoscaling the way
  // `scales.y` does. A span must declare the pair as well as spell it, its
  // ramp resolving in the worker against each region's own extremes.
  const openRamp = entries.flatMap((mark, i) => {
    const domain = rampDomain(mark)
    if (!domain) {
      return []
    }
    const pinnedPair = domain.length === 2 && domain.every(pinned)
    const declared = domain.length > 0
    return (mark.shape === 'span' ? !pinnedPair : declared && !pinnedPair)
      ? [`mark ${i}`]
      : []
  })
  if (openRamp.length > 0) {
    throw new Error(
      `LinearMarkDisplay: a colour ramp spans a pinned [min, max] of two finite numbers, and ${openRamp.join(', ')} leaves encoding.color.domain short or open — a span needs the pair declared because its ramp resolves in the worker against each region's own extremes, and every other shape reads an open end as 0`,
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
     * order, after the display's own `transform`, and over each section alone
     * under a facet. A `bin` then an `aggregate` grouped by `start` and `end`
     * is a density: `count` per bin, plotted as `y`.
     */
    transform: types.array(transformStepSchema),
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
      defaultValue: 'features',
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
    requires: [{ when: { shape: ['bar', 'point'] }, slots: ['encoding.y'] }],
  },
)

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
      transform: types.array(transformStepSchema),
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
       */
      scales: markScalesSchema,
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
export type MarkTransformStepConfig = Instance<typeof transformStepSchema>
