import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { retiredBaseDisplaySpellings } from '@jbrowse/display-kit/configSchema'
import { rowColorConfigSchema } from '@jbrowse/display-kit/rowColorConfigSchema'
import { trackHeightConfigSchemaFields } from '@jbrowse/display-kit/trackHeightConfigSchemaFields'
import { types } from '@jbrowse/mobx-state-tree'
import {
  rowSeparatorsConfigSchemaFields,
  treeSidebarConfigSchemaFields,
} from '@jbrowse/tree-sidebar/treeSidebarConfigSchemaFields'
import {
  retiredAxisSpellings,
  retiredScaleSpellings,
} from '@jbrowse/wiggle-core'

import { extentConfigSchemaFields } from '../shared/extentConfigSchemaFields.ts'
import { quantitativeRowsConfigSchema } from '../shared/quantitativeRowsConfigSchema.ts'
import { wiggleColorSchema } from '../shared/wiggleColorConfigSchema.ts'
import {
  wiggleConfigSchemaFields,
  wiggleValueScale,
} from '../shared/wiggleConfigSchemaFields.ts'
import { LINE_INTERPOLATIONS, WIGGLE_MARK_NAMES, markOf } from '../util.ts'
import { retiredConfigSpellings } from './retired.ts'

/**
 * #config LinearWiggleDisplay
 * #category display
 * Draws quantitative signal as bars, points, a line or a color strip (`span`),
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
 *     scales: { y: { type: 'log' } },
 *     color: 'darkgreen',
 *   },
 * }
 * ```
 */
const linearWiggleDisplayConfigSchema = ConfigurationSchema(
  'LinearWiggleDisplay',
  {
    /**
     * #slot mark
     * The shape each score is drawn as, using the mark display's names: `bar` draws a bar
     * from the `origin` to the score, `point` a point at it, `line` a line
     * through the scores, and `span` a strip whose color is the score. The
     * track menu's Plot type writes it. v4's `defaultRendering` loads as its
     * `mark`: `xyplot` a bar, `scatter` a point, `density` a span, and
     * `line` and `linecenter` a line.
     * #example
     * ```json
     * {
     *   "type": "LinearWiggleDisplay",
     *   "mark": "span"
     * }
     * ```
     */
    mark: {
      type: 'stringEnum',
      model: types.enumeration('WiggleMark', [...WIGGLE_MARK_NAMES]),
      defaultValue: 'bar',
      description: 'bar, point, line or span',
      plot: true,
    },
    /**
     * #slot interpolate
     * The path a `line` takes between scores: `step` holds each across its
     * bin, as the data says; `linear` runs from one bin's centre to the next, smoother
     * where the bins are few. Read by a line alone.
     */
    interpolate: {
      type: 'stringEnum',
      model: types.enumeration('LineInterpolation', [...LINE_INTERPOLATIONS]),
      defaultValue: 'step',
      description: 'step or linear, for a line',
      plot: true,
    },
    /**
     * #slot rows
     * One row per value of a field, stacked down the track with a label, a
     * separator and the clustering sidebar, and the arrangement a reader gives
     * them. `source` — one row per subtrack — is the only field this display
     * reads; leave it unset and every source is drawn in one shared plot.
     * `domain` is the row order: the subtracks it names lead, the rest keep
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
     * The color a reader set on a named subtrack, as `domain`/`range` pairs,
     * ahead of the adapter's color and the palette: its plot while `color` is
     * unset, and otherwise, or under a score gradient, the tint beside its
     * label.
     * #example
     * ```json
     * {
     *   "type": "LinearWiggleDisplay",
     *   "rowColor": { "domain": ["tumor"], "range": ["#b2182b"] }
     * }
     * ```
     */
    rowColor: rowColorConfigSchema,
    ...trackHeightConfigSchemaFields(),
    /**
     * #slot color
     * One CSS color, or `score` through a scale — `threshold` for the
     * bicolor plot, `linear` for the density ramp. Unset, it is the pos/neg
     * pair about the `origin`, and several sources in one plot box each
     * paint their row color.
     * #example
     * ```json
     * {
     *   "type": "LinearWiggleDisplay",
     *   "color": { "field": "score", "scale": "threshold", "domain": [2] }
     * }
     * ```
     */
    color: wiggleColorSchema,
    ...wiggleConfigSchemaFields,
    /**
     * #slot scales
     * The y scale the plot is drawn through: `type`, `domainMin`,
     * `domainMax`, `domainQuantile`, `symlogConstant`
     * and `rules`, the reference lines drawn across it. The density rendering
     * draws no rule and does not widen to one: it spends color on the score
     * and has no axis to rule.
     * #example
     * ```json
     * {
     *   "type": "LinearWiggleDisplay",
     *   "scales": { "y": { "rules": [{ "value": 30, "label": "2 copies" }, 15] } }
     * }
     * ```
     */
    scales: wiggleValueScale(),
    /**
     * #slot
     */
    showLegend: {
      type: 'boolean',
      description:
        "Draw the key: density's score color ramp, or the source colors where several share one plot. Defaults to on",
      defaultValue: true,
    },
    ...extentConfigSchemaFields({ extent: 'min-max' }),
    ...treeSidebarConfigSchemaFields({
      tree: 'Show the subtrack clustering tree in the sidebar',
      rowLabels: 'Name each subtrack row down the left edge',
    }),
    ...rowSeparatorsConfigSchemaFields(),
  },
  {
    explicitlyTyped: true,
    explicitIdentifier: 'displayId',
    retired: {
      ...retiredBaseDisplaySpellings,
      ...retiredAxisSpellings,
      ...retiredScaleSpellings,
      ...retiredConfigSpellings,
      defaultRendering: rendering =>
        markOf(String(rendering)) ?? { mark: rendering },
      lineWidth: size => ({ size }),
    },
  },
)

export default linearWiggleDisplayConfigSchema

export type LinearWiggleDisplayConfigSchema =
  typeof linearWiggleDisplayConfigSchema
