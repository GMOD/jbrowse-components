import { ConfigurationSchema, plotList } from '@jbrowse/core/configuration'
import { SHAPE_NAMES } from '@jbrowse/core/util/shapeNames'
import {
  colorScaleOptions,
  paintedScale,
} from '@jbrowse/display-kit/colorConfigSchema'
import { retiredBaseDisplaySpellings } from '@jbrowse/display-kit/configSchema'
import { fieldPredicateList } from '@jbrowse/display-kit/fieldPredicateConfigSchema'
import { legendConfigSchema } from '@jbrowse/display-kit/legendConfigSchema'
import { regionTooLargeConfigSchemaFields } from '@jbrowse/display-kit/regionTooLargeConfigSchemaFields'
import { rowColorConfigSchema } from '@jbrowse/display-kit/rowColorConfigSchema'
import { rowsConfigSchema } from '@jbrowse/display-kit/rowsConfigSchema'
import { trackHeightConfigSchemaFields } from '@jbrowse/display-kit/trackHeightConfigSchemaFields'
import { types } from '@jbrowse/mobx-state-tree'
import { rowHeightConfigSchemaFields } from '@jbrowse/tree-sidebar/rowHeightConfigSchemaFields'
import { treeSidebarConfigSchemaFields } from '@jbrowse/tree-sidebar/treeSidebarConfigSchemaFields'
import {
  retiredScalesSpelling,
  yChannelSchema,
  yEncodingSchema,
} from '@jbrowse/wiggle-core'

import { markColorSchema, markLegendOptions } from './markColorConfigSchema.ts'
import { markDefSchema } from './markDefConfigSchema.ts'
import { markFacetSchema } from './markFacetConfigSchema.ts'
import { markLocusSchema } from './markLocusConfigSchema.ts'
import { markSizeSchema } from './markSizeConfigSchema.ts'
import { markTransformStep } from './markTransformConfigSchema.ts'
import { DEFAULT_TEXT_FIELD, MARK_TYPES, markTypeOf } from './markVocabulary.ts'
import { MARK_Y_PATHS } from './markYPaths.ts'

import type { MarkDefSnapshot } from './markVocabulary.ts'
import type { ConfigurationSlotPath } from '@jbrowse/core/configuration'
import type { Instance, SnapshotIn } from '@jbrowse/mobx-state-tree'

export { MARK_TYPES } from './markVocabulary.ts'
export type { MarkType } from './markVocabulary.ts'

const MARK_SHAPE_SCALES = ['ordinal'] as const
export type MarkShapeScale = (typeof MARK_SHAPE_SCALES)[number]

/** The scale a mark's shape is drawn through: `ordinal` beside a `field`. */
export function markShapeScale(shape: {
  scale: { type: MarkShapeScale | undefined }
  field: string
}) {
  return paintedScale(shape, 'ordinal')
}

const markShapeSchema = ConfigurationSchema(
  'MarkShape',
  {
    /**
     * #slot marks.encoding.shape.value
     * `circle`, `triangle-down`, `diamond` or `square`, or a jexl callback
     * over `feature` returning one, for a point mark whose shape is not a
     * scale.
     */
    value: {
      type: 'stringEnum',
      model: types.enumeration('ShapeName', [...SHAPE_NAMES]),
      defaultValue: 'circle',
      description: 'circle, triangle-down, diamond, square or jexl callback',
      contextVariable: ['feature'],
    },
    /**
     * #slot marks.encoding.shape.field
     * The feature field an ordinal scale reads — or a jexl expression over
     * `feature`, which is slower per feature and so the opt-in.
     */
    field: {
      type: 'featureField',
      defaultValue: '',
      description: 'feature field, or jexl expression',
    },
    /**
     * #slot marks.encoding.shape.scale
     * How the field's values map to shapes, Vega-Lite's scale object.
     */
    scale: ConfigurationSchema(
      'MarkShapeScale',
      {
        /**
         * #slot marks.encoding.shape.scale.type
         * `ordinal` hands a shape from `range` to each distinct value of
         * `field`. Unset beside a `field`, it is `ordinal`.
         */
        type: {
          type: 'maybeStringEnum',
          model: types.enumeration('MarkShapeScaleType', [
            ...MARK_SHAPE_SCALES,
          ]),
          description: 'ordinal; unset follows field',
        },
        /**
         * #slot marks.encoding.shape.scale.range
         * The shape names an ordinal scale hands out, in order. Empty is
         * `circle`, `triangle-down`, `diamond`; `square` draws only where
         * listed.
         */
        range: {
          type: 'stringEnumArray',
          model: types.enumeration('ShapeName', [...SHAPE_NAMES]),
          defaultValue: [],
          description: 'shape names, in order',
        },
        /**
         * #slot marks.encoding.shape.scale.domain
         * The values in legend order, walking `range` from the first entry;
         * left empty, each value derives its shape from itself, so every
         * region agrees.
         */
        domain: {
          type: 'stringArray',
          defaultValue: [],
          description: 'category order',
        },
        /**
         * #slot marks.encoding.shape.scale.names
         * The key's name for each `domain` value, one each in order; a value
         * past the end of the list shows its name.
         */
        names: {
          type: 'stringArray',
          defaultValue: [],
          description: 'key names for the domain values, in order',
        },
      },
      colorScaleOptions('encoding.shape.scale'),
    ),
    /**
     * #slot marks.encoding.shape.legend
     * The key this channel's scale draws.
     */
    legend: ConfigurationSchema(
      'MarkShapeLegend',
      {
        /**
         * #slot marks.encoding.shape.legend.title
         * The heading of the key an ordinal scale draws, naming what the
         * shape marks. Unset, the key is titled with `field`; `""` is a key
         * with no title.
         */
        title: {
          type: 'maybeString',
          description: 'key title; unset follows field, "" draws none',
        },
        /**
         * #slot marks.encoding.shape.legend.values
         * The values the key lists, in this order; empty lists every value
         * the loaded regions met. A value left out still takes its shape.
         */
        values: {
          type: 'stringArray',
          defaultValue: [],
          description: 'values the key lists; empty lists every value met',
        },
        /**
         * #slot marks.encoding.shape.legend.missingLabel
         * The key's name for a feature with nothing in `field`; unset is
         * "(no value)". Vega-Lite's legend has no such member, so it keeps
         * its JBrowse name.
         */
        missingLabel: {
          type: 'maybeString',
          description: 'key row for a feature with no value',
        },
      },
      markLegendOptions,
    ),
  },
  {
    shorthand: 'field',
    writes: 'whole',
    closed: true,
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
     * The feature field, or jexl expression, giving the mark's right edge in
     * bp, or for a link its far foot: an object naming the field holding
     * the foot's sequence beside the one holding its position, where a mate
     * may lie on another sequence. Left at `end` behind a `mate` step, it is
     * the other end the step found.
     */
    x2: markLocusSchema,
    /**
     * #slot marks.encoding.y
     * The feature field, or jexl expression over `feature`, plotted on the score
     * axis. A feature whose value is not a finite number is skipped. Empty
     * reads what the steps before this mark's encode wrote, the way a ggplot2
     * stat names what its geom plots: a `coverage` step's depth, or the one
     * summary an `aggregate` with one op writes. A bar or point with neither
     * draws nothing and the track shows a corner notice, while a text with
     * neither stands at the apex of a link drawn between its two ends, or in
     * the middle of its band where none is. The scale it is read through is
     * the display's `encoding.y`.
     */
    y: {
      type: 'featureField',
      defaultValue: '',
      description: 'value field, or jexl expression; empty follows a step',
    },
    /**
     * #slot marks.encoding.row
     * The feature field, or jexl expression, naming the band the mark stands in,
     * an integer from 0; a feature with nothing there sits on band 0. Empty
     * reads the field the last `pileup` before this mark's encode wrote, this
     * mark's own, the facet's or the display's, and puts every mark on one
     * band across the whole plot where none packs.
     */
    row: {
      type: 'featureField',
      defaultValue: '',
      description: 'band field; empty follows a pileup step',
    },
    /**
     * #slot marks.encoding.color
     * The mark's color: a field through an ordinal or continuous `scale`,
     * written bare or as an object, or a constant `{ value }`, a CSS color or
     * a jexl callback returning one. `legend` shapes the key the scale draws.
     */
    color: markColorSchema,
    /**
     * #slot marks.encoding.shape
     * For a point mark: a field through an ordinal scale over `circle`,
     * `triangle-down` and `diamond`, written bare or as an object, or a
     * constant `{ value }`, one of those names, `square`, or a jexl callback
     * returning one. `legend` shapes the key the scale draws.
     */
    shape: markShapeSchema,
    /**
     * #slot marks.encoding.text
     * For a text mark: the feature field, or jexl expression over `feature`,
     * it prints, `name` unset. A feature with nothing there prints nothing.
     */
    text: {
      type: 'featureField',
      defaultValue: DEFAULT_TEXT_FIELD,
      description: 'text field, or jexl expression',
    },
    /**
     * #slot marks.encoding.size
     * A point's diameter in px. The track menu's Point size writes every
     * point mark's number.
     */
    size: markSizeSchema,
    /**
     * #slot marks.encoding.strokeWidth
     * A stroked mark's width in px, Vega-Lite's stroke width: a rule's or a
     * line's thickness, or a link's stroke; a field, which a link alone
     * reads, goes through a linear or log `scale` into a width, `scale.range`
     * the px at each end of the domain.
     */
    strokeWidth: markSizeSchema,
  },
  { closed: true },
)

// The one thing a load refuses of a `marks` list: a mark type the display does
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
  const unknownMarks = (marks as { mark?: MarkDefSnapshot }[]).flatMap(
    (mark, i) => {
      const type: string = markTypeOf(mark)
      return (MARK_TYPES as readonly string[]).includes(type)
        ? []
        : [`marks.${i}.mark is "${type}"`]
    },
  )
  if (unknownMarks.length > 0) {
    throw new Error(
      `LinearMarkDisplay: ${unknownMarks.join(', ')}, and a mark is one of ${MARK_TYPES.join(', ')}`,
    )
  }
  return snap
}

const markSchema = ConfigurationSchema(
  'Mark',
  {
    /**
     * #slot marks.mark
     * What the mark draws, a [](/docs/config/markdef) object or its `type`
     * alone: `bar`, `point`, `rule`, `line`, `span`, `text` or `link`, with
     * the members one type reads, a line's or a link's `interpolate`, a
     * span's `height` and a line's `gapBp`.
     */
    mark: markDefSchema,
    /**
     * #slot marks.encoding
     * The feature field each of the mark's channels reads. Every channel has
     * a default, so `{}` draws a bar from `start` to `end` with no value.
     */
    encoding: markEncodingSchema,
    /**
     * #slot marks.transform
     * Steps over the region's features before this mark encodes them, in
     * order, after the display's own `transform`, and over each section alone
     * under a facet. A `bin` then an `aggregate` grouped by `start` and `end`
     * is a density: `count` per bin, which the mark plots as `y` unless its
     * encoding names another field.
     */
    transform: types.array(markTransformStep),
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
  { closed: true },
)

/**
 * A `marks` list that draws `defaults` until a config writes its own: how a
 * display built on this one names its default plot, which a snapshot at that
 * plot then leaves out.
 */
export function markListSchema(defaults: SnapshotIn<typeof markSchema>[]) {
  return plotList(types.stripDefault(types.array(markSchema), defaults))
}

/**
 * #config LinearMarkDisplay
 * #category display
 * A grammar of graphics over a feature, alignments or variant track: a list of
 * marks — bars, points, rules, lines, spans, text or links — each with an encoding naming which
 * feature fields feed its channels and a transform list run before it. One fetch per
 * region evaluates every encoding in the worker; the marks draw in order over
 * one score axis.
 *
 * #example
 * A BED score column as bars, colored by strand, with the key on screen,
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
 *           mark: 'bar',
 *           encoding: {
 *             y: 'score',
 *             color: { field: 'strand', scale: { type: 'ordinal' } },
 *           },
 *           maxBpPerPx: 100,
 *         },
 *         {
 *           mark: 'bar',
 *           transform: [
 *             { type: 'bin', step: 10000 },
 *             { type: 'aggregate', groupby: ['start', 'end'], ops: [{ op: 'count' }] },
 *           ],
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
      /**
       * #slot marks
       * The marks to draw, in order — a later one paints over an earlier one.
       * Each is a `mark` and an `encoding`.
       */
      marks: markListSchema([]),
      /**
       * #slot transform
       * Steps over the region's features before the facet splits them and
       * before any mark's own, after `filter`: where a field the facet
       * reads is made, such as a formula lifting a read's tag.
       */
      transform: plotList(types.array(markTransformStep)),
      /**
       * #slot facet
       * Labelled sections, one per value of a field, each as tall as its
       * steps pack it: `"HP"`, or `{ field, domain, transform }` with the
       * order the sections stack in and the steps each runs before any mark's,
       * a per-section `pileup` among them. A chip names each section and hides
       * it. Split after `transform` and before any mark's own steps.
       */
      facet: markFacetSchema,
      /**
       * #slot rows
       * One row per value of a field: `"source"` over
       * a multi-BigWig is one xyplot per file. The worker splits the features
       * on the field as it does for `facet`, and the rows take the tree
       * sidebar, the row labels, clustering and the arrangement dialog, whose
       * order, labels, tree and focus this object holds. Beside a `facet`, the
       * facet draws; on another field that asks for bands of rows, which are
       * not drawn yet, the display shows a notice.
       *
       * #example
       * ```js
       * { rows: 'source' }
       * ```
       * ```js
       * { rows: { field: 'source', sort: ['tumor', 'normal'] } }
       * ```
       */
      rows: rowsConfigSchema,
      /**
       * #slot rowColor
       * The bar beside each row's label; the marks keep their color. Under
       * the default field `name`, a row's value paired with a color in
       * `scale.domain`/`scale.range`, which the arrangement dialog writes.
       */
      rowColor: rowColorConfigSchema,
      ...treeSidebarConfigSchemaFields({
        tree: 'show the cluster tree beside the rows',
        rowLabels: 'draw the row value over the left of each row',
      }),
      ...rowHeightConfigSchemaFields({
        rowHeight:
          'per-row height in px under rows, scrolling the rows that do not fit; 0 (the default) fits the rows to the plot instead, dividing it between them',
      }),
      /**
       * #slot encoding
       * The channels the marks are read through, owned by the display rather
       * than by a mark: `y` alone, a [YChannel](../ychannel) every mark's
       * `encoding.y` shares. It names no field, since each mark names its
       * own, so a bare string here is refused.
       * #example
       * ```js
       * { encoding: { y: { scale: { type: 'log' }, axis: { title: 'depth' } } } }
       * ```
       */
      encoding: yEncodingSchema(yChannelSchema()),
      /**
       * #slot origin
       * The value bars grow from. The axis widens to include it whenever a
       * bar mark is drawn.
       */
      origin: {
        type: 'number',
        defaultValue: 0,
        description: 'baseline value for bars',
        plot: true,
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
       * #slot legend
       * The key for every mark whose color or shape is a scale; `show`
       * defaults to on.
       */
      legend: legendConfigSchema,
      /**
       * #slot filter
       * The features the display draws, a list of
       * [](/docs/config/fieldpredicate) entries a feature must all pass: a
       * field of the feature's own (`{ field: "score", gte: 5 }`) or a
       * `jexl:` expression that must hold.
       */
      filter: fieldPredicateList(),
    },
    {
      explicitlyTyped: true,
      explicitIdentifier: 'displayId',
      retired: {
        scales: retiredScalesSpelling(MARK_Y_PATHS.members),
        ...retiredBaseDisplaySpellings,
      },
      preProcessSnapshot: checkMarks,
    },
  )
}

Object.values(MARK_Y_PATHS.members) satisfies readonly ConfigurationSlotPath<
  ReturnType<typeof configSchemaFactory>
>[]

export type LinearMarkDisplayConfigModel = ReturnType<
  typeof configSchemaFactory
>
export type LinearMarkDisplayConfig = Instance<LinearMarkDisplayConfigModel>
export type MarkConfig = Instance<typeof markSchema>
export type { MarkTransformStepConfig } from './markTransformConfigSchema.ts'
