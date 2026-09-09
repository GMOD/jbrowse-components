import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { DEFAULT_MARK_COLOR } from '@jbrowse/core/util/markEncoding'
import { trackHeightConfigSchemaFields } from '@jbrowse/display-kit/trackHeightConfigSchemaFields'
import { types } from '@jbrowse/mobx-state-tree'
import { scoreAxisConfigSchemaFields } from '@jbrowse/wiggle-core'

import type { Instance } from '@jbrowse/mobx-state-tree'

export const MARK_SHAPES = ['bar', 'point', 'span'] as const
export type MarkShapeName = (typeof MARK_SHAPES)[number]

export const DEFAULT_POINT_DIAMETER_PX = 4

// `color: 'red'` and `color: 'jexl:…'` are the unscaled arm, spelled as the
// bare string every other colour slot takes; the object form binds a field to
// a scale. One sub-schema holds both, so the string is lifted into `value`.
// A `domain` written as numbers (a ramp's `[0, 100]`) is carried as strings,
// which is the one array slot type the schema has; the display parses the
// numbers back for a ramp.
function normalizeColor(snap: unknown) {
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
     * #slot
     */
    value: {
      type: 'color',
      defaultValue: DEFAULT_MARK_COLOR,
      description:
        'CSS colour, or a jexl callback returning one, when no scale is set',
      contextVariable: ['feature'],
    },
    /**
     * #slot
     */
    field: {
      type: 'string',
      defaultValue: '',
      description:
        'the feature field a scale reads, or a jexl callback over `feature`',
    },
    /**
     * #slot
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
      description:
        'how `field` becomes a colour: `categorical` hands out palette entries per distinct value, `linear`/`log` read the value through `domain` into `ramp`',
    },
    /**
     * #slot
     */
    palette: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'CSS colours a categorical scale hands out in order; empty uses the built-in qualitative palette',
    },
    /**
     * #slot
     */
    domain: {
      type: 'stringArray',
      defaultValue: [],
      description:
        "categorical: the values in legend order, pinning their colours across regions. linear/log: the `[min, max]` the ramp spans; empty uses each region's own extremes",
    },
    /**
     * #slot
     */
    ramp: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'a linear/log scale\'s ramp: `["viridis"]`, or two or more CSS colour stops; empty is viridis',
    },
  },
  { preProcessSnapshot: normalizeColor },
)

const markEncodingSchema = ConfigurationSchema('MarkEncoding', {
  /**
   * #slot
   */
  x: {
    type: 'string',
    defaultValue: 'start',
    description:
      "the feature field (or jexl callback) giving the mark's left edge, in bp",
  },
  /**
   * #slot
   */
  x2: {
    type: 'string',
    defaultValue: 'end',
    description:
      "the feature field (or jexl callback) giving the mark's right edge, in bp",
  },
  /**
   * #slot
   */
  y: {
    type: 'string',
    defaultValue: '',
    description:
      'the feature field (or jexl callback) plotted on the score axis; empty for a mark with no value (a span)',
  },
  /**
   * #slot
   */
  color: markColorSchema,
  /**
   * #slot
   */
  glyph: {
    type: 'string',
    defaultValue: 'disc',
    description:
      'for a point mark: `disc`, `triangle` or `diamond`, or a jexl callback returning one',
  },
})

const markSchema = ConfigurationSchema('Mark', {
  /**
   * #slot
   */
  shape: {
    type: 'stringEnum',
    model: types.enumeration('MarkShape', [...MARK_SHAPES]),
    defaultValue: 'bar',
    description:
      '`bar` stands between the origin and `y`, `point` is a glyph at `y`, `span` is a band across the plot from `x` to `x2`',
  },
  /**
   * #slot
   */
  encoding: markEncodingSchema,
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
 * A BED score column as bars, coloured by strand, with the key on screen:
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
       * #slot
       * The marks to draw, in order — a later one paints over an earlier one.
       */
      marks: types.array(markSchema),
      ...scoreAxisConfigSchemaFields,
      /**
       * #slot
       */
      origin: {
        type: 'number',
        defaultValue: 0,
        description:
          'the value bars grow from; the axis widens to include it whenever a bar mark is drawn',
      },
      /**
       * #slot
       */
      minWidthPx: {
        type: 'number',
        defaultValue: 1,
        description:
          'narrowest a bar or span is painted, in px, grown off its start edge',
        advanced: true,
      },
      /**
       * #slot
       */
      scatterPointSize: {
        type: 'maybeNumber',
        promotedBase: DEFAULT_POINT_DIAMETER_PX,
        description:
          'diameter in px of point marks. Unset (the default) follows the session-wide default for this display type',
      },
      /**
       * #slot
       */
      minimalTicks: {
        type: 'boolean',
        defaultValue: false,
        description: 'Draw only the min/max Y-axis ticks',
        advanced: true,
      },
      /**
       * #slot
       */
      showLegend: {
        type: 'maybeBoolean',
        promotedBase: true,
        description:
          'Draw the colour key for every mark whose colour is a scale. Unset (the default) follows the session-wide default for this display type, falling back to on',
      },
      /**
       * #slot
       */
      jexlFilters: {
        type: 'stringArray',
        defaultValue: [],
        description:
          'jexl filters every feature must pass before it is encoded, without the jexl prefix',
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
