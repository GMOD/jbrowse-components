import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { retiredBaseDisplaySpellings } from '@jbrowse/display-kit/configSchema'
import { legendConfigSchema } from '@jbrowse/display-kit/legendConfigSchema'
import { rowColorConfigSchema } from '@jbrowse/display-kit/rowColorConfigSchema'
import { trackHeightConfigSchemaFields } from '@jbrowse/display-kit/trackHeightConfigSchemaFields'
import {
  retiredRowAxisWithGridSpellings,
  rowAxisWithGridConfigSchema,
} from '@jbrowse/tree-sidebar/rowAxisWithGridConfigSchema'
import {
  retiredAxisSpellings,
  retiredScaleSpellings,
  retiredScalesSpelling,
} from '@jbrowse/wiggle-core'

import { extentConfigSchemaFields } from '../shared/extentConfigSchemaFields.ts'
import { quantitativeRowsConfigSchema } from '../shared/quantitativeRowsConfigSchema.ts'
import { wiggleConfigSchemaFields } from '../shared/wiggleConfigSchemaFields.ts'
import { wiggleDataConfigSchema } from '../shared/wiggleDataConfigSchema.ts'
import { wiggleEncodingConfigSchema } from '../shared/wiggleEncodingConfigSchema.ts'
import { wiggleMarkConfigSchema } from '../shared/wiggleMarkConfigSchema.ts'
import { WIGGLE_Y_PATHS } from '../shared/wiggleYPaths.ts'
import { WIGGLE_MARK_NAMES, markOf } from '../util.ts'
import { retiredConfigSpellings } from './retired.ts'

import type { ConfigurationSlotPath } from '@jbrowse/core/configuration'

/**
 * #config LinearWiggleDisplay
 * #category display
 * Draws quantitative signal as bars, points, a line or a color strip (`rect`),
 * for one source or many; `rows: 'source'` draws each source in a separate row.
 *
 * Per-source metadata (a `name`, `color` and `group` for each) is preloaded on
 * the *adapter* rather than here — see `MultiWiggleAdapter`'s `subadapters`
 * slot, where `group` drives the sidebar clustering tree and `color` sets each
 * source's line or fill.
 *
 * These are display-level slots: set them inside a track's `displays` to
 * change its defaults (setting them at the track top level has no effect).
 * The object shorthand `displayDefaults: { key: value }` is equivalent to the
 * full `displays: [{ type: 'LinearWiggleDisplay', displayId: '...', key: value }]`
 * array form — see
 * [configuring displays](/docs/config_guides/tracks#configuring-displays).
 *
 * #example
 * Minimal `QuantitativeTrack` config. See the
 * [quantitative track guide](/docs/config_guides/quantitative_track) for all
 * adapter and display options:
 * ```js
 * {
 *   type: 'QuantitativeTrack',
 *   trackId: 'coverage',
 *   name: 'Coverage',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'BigWigAdapter', uri: 'https://example.com/coverage.bw' },
 * }
 * ```
 *
 * #example
 * Several bigWigs, which a `MultiQuantitativeTrack` stacks one per row:
 * ```js
 * {
 *   type: 'MultiQuantitativeTrack',
 *   trackId: 'coverage_by_sample',
 *   name: 'Coverage by sample',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'MultiWiggleAdapter',
 *     bigWigs: [
 *       'https://example.com/sample1.bw',
 *       'https://example.com/sample2.bw',
 *     ],
 *   },
 * }
 * ```
 *
 * #example
 * Taller track, log scale, custom color:
 * ```js
 * {
 *   type: 'QuantitativeTrack',
 *   trackId: 'coverage',
 *   name: 'Coverage',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'BigWigAdapter', uri: 'https://example.com/coverage.bw' },
 *   displayDefaults: {
 *     height: 200,
 *     encoding: {
 *       y: { scale: { type: 'log' } },
 *       color: { value: 'darkgreen' },
 *     },
 *   },
 * }
 * ```
 */
const linearWiggleDisplayConfigSchema = ConfigurationSchema(
  'LinearWiggleDisplay',
  {
    /**
     * #slot mark
     * The shape each score is drawn as, using the mark display's names: `bar`
     * draws a bar from the `origin` to the score, `point` a point at it,
     * `line` a line through the scores, stepped or as `interpolate` says, and
     * `rect` a strip whose color is the score. The track menu's Plot type
     * writes it. v4's `defaultRendering` loads as its `mark`: `xyplot` a bar,
     * `scatter` a point, `density` a span, `line` a stepped line and
     * `linecenter` a linear one.
     * A [](/docs/config/wigglemark) object, or its `type` alone.
     * #example
     * ```json
     * {
     *   "type": "LinearWiggleDisplay",
     *   "mark": "rect"
     * }
     * ```
     */
    mark: wiggleMarkConfigSchema,
    /**
     * #slot rows
     * One row per value of a field, stacked down the track with a label, a
     * separator and the clustering sidebar, and the arrangement a reader gives
     * them. `source` — one row per subtrack — is the only field this display
     * reads; leave it unset and every source is drawn in one shared plot.
     * `sort` is the row order: the subtracks it names lead, the rest keep
     * the adapter's order, and a clustering run rotates its dendrogram towards
     * it rather than discarding it. `labels`, `tree`, `treeProvenance` and
     * `kept` are what the arrangement dialog, a clustering run and a focus
     * write, each as a session edit to this object.
     * #example
     * ```json
     * {
     *   "type": "LinearWiggleDisplay",
     *   "rows": "source"
     * }
     * ```
     */
    rows: quantitativeRowsConfigSchema,
    /**
     * #slot rowColor
     * The color a reader set on a named subtrack, as `scale.domain` and
     * `scale.range` pairs, ahead of the adapter's color and the palette: its
     * plot while `encoding.color` is unset, and otherwise, or under a score
     * gradient, the tint beside its label.
     * #example
     * ```json
     * {
     *   "type": "LinearWiggleDisplay",
     *   "rowColor": { "scale": { "domain": ["tumor"], "range": ["#b2182b"] } }
     * }
     * ```
     */
    rowColor: rowColorConfigSchema,
    ...trackHeightConfigSchemaFields(),
    /**
     * #slot encoding
     * The channels the marks paint through. `encoding.color` is one CSS
     * color in `value`, or the score through a `scale` — `threshold` for
     * solid bands, `linear` for a gradient; unset, it is the pos/neg pair
     * about the `origin`, which a heatmap fades to from white there, and
     * several sources in one plot box each paint their row color.
     * `encoding.y` is the field plotted and the value axis it is drawn
     * through: `field`, `scale`, `axis` and `rules`. `encoding.size` is a
     * point's diameter and `encoding.strokeWidth` a line's width, in px. The
     * row axis beside `rows` is `axis`.
     * #example
     * ```json
     * {
     *   "type": "LinearWiggleDisplay",
     *   "encoding": { "color": { "scale": { "type": "threshold", "domain": [2] } } }
     * }
     * ```
     * ```json
     * {
     *   "type": "LinearWiggleDisplay",
     *   "encoding": { "y": { "rules": [{ "value": 30, "label": "2 copies" }, 15] } }
     * }
     * ```
     */
    encoding: wiggleEncodingConfigSchema,
    /**
     * #slot data
     * What the fetch reads, a [](/docs/config/wiggledata) object: `resolution`
     * is the points per pixel asked of a tiered file.
     */
    data: wiggleDataConfigSchema,
    ...wiggleConfigSchemaFields,
    /**
     * #slot legend
     * The key: density's score color ramp, a threshold's bands, or the
     * source colors where several share one plot.
     */
    legend: legendConfigSchema,
    ...extentConfigSchemaFields({ extent: 'min-max' }),
    /**
     * #slot axis
     * The row axis down the left of the subtrack rows: the clustering tree,
     * each subtrack's name and the lines between rows. The value axis is
     * `encoding.y.axis`.
     */
    axis: rowAxisWithGridConfigSchema,
  },
  {
    explicitlyTyped: true,
    explicitIdentifier: 'displayId',
    retired: {
      scales: retiredScalesSpelling(WIGGLE_Y_PATHS.members),
      y: field => ({ encoding: { y: { field } } }),
      ...retiredBaseDisplaySpellings,
      ...retiredAxisSpellings(WIGGLE_Y_PATHS.members),
      ...retiredScaleSpellings(WIGGLE_Y_PATHS.members),
      ...retiredConfigSpellings,
      ...retiredRowAxisWithGridSpellings,
      defaultRendering: rendering => {
        if (rendering === null) {
          return { mark: null }
        }
        const mark =
          markOf(String(rendering)) ??
          WIGGLE_MARK_NAMES.find(name => name === rendering)
        if (!mark) {
          console.warn(
            `LinearWiggleDisplay has no rendering ${JSON.stringify(rendering)}: drawing the default mark`,
          )
        }
        return mark ? { mark } : {}
      },
    },
  },
)

Object.values(WIGGLE_Y_PATHS.members) satisfies readonly ConfigurationSlotPath<
  typeof linearWiggleDisplayConfigSchema
>[]

export default linearWiggleDisplayConfigSchema

export type LinearWiggleDisplayConfigSchema =
  typeof linearWiggleDisplayConfigSchema
