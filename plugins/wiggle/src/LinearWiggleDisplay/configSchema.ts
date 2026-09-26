import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { rowColorConfigSchema } from '@jbrowse/display-kit/rowColorConfigSchema'
import { rowsConfigSchema } from '@jbrowse/display-kit/rowsConfigSchema'
import { trackHeightConfigSchemaFields } from '@jbrowse/display-kit/trackHeightConfigSchemaFields'
import { types } from '@jbrowse/mobx-state-tree'
import {
  rowSeparatorsConfigSchemaFields,
  treeSidebarConfigSchemaFields,
} from '@jbrowse/tree-sidebar/treeSidebarConfigSchemaFields'
import { retiredAxisSpellings } from '@jbrowse/wiggle-core'

import { checkRowsField } from '../shared/checkRowsField.ts'
import { summaryScoreModeConfigSchemaFields } from '../shared/summaryScoreModeConfigSchemaFields.ts'
import { wiggleColorSchema } from '../shared/wiggleColorConfigSchema.ts'
import {
  wiggleConfigSchemaFields,
  wiggleValueScale,
} from '../shared/wiggleConfigSchemaFields.ts'
import { LINE_INTERPOLATIONS, WIGGLE_MARKS, markOf } from '../util.ts'

/**
 * #config LinearWiggleDisplay
 * #category display
 * configuration for the quantitative display: an XY plot, density, line or
 * scatter rendering of one source or of many, with `rows: 'source'` giving
 * each source a row of its own
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
     * What each score is drawn as, in the mark display's words: `bar`, a bar
     * from the `origin` to the score; `point`, a point at it; `line`, a line
     * through the scores; `heatmap`, a strip whose colour is the score. The
     * track menu's Plot type writes it. v4's `defaultRendering` loads as its
     * `mark`: `xyplot` a bar, `scatter` a point, `density` a heatmap, and
     * `line` and `linecenter` a line.
     * #example
     * ```json
     * {
     *   "type": "LinearWiggleDisplay",
     *   "mark": "heatmap"
     * }
     * ```
     */
    mark: {
      type: 'stringEnum',
      model: types.enumeration('WiggleMark', [...WIGGLE_MARKS]),
      defaultValue: 'bar',
      description: 'bar, point, line or heatmap',
    },
    /**
     * #slot interpolate
     * How a `line` joins its scores: `step` holds each across its bin, as the
     * data says; `linear` runs from one bin's centre to the next, smoother
     * where the bins are few. Read by a line alone.
     */
    interpolate: {
      type: 'stringEnum',
      model: types.enumeration('LineInterpolation', [...LINE_INTERPOLATIONS]),
      defaultValue: 'step',
      description: 'step or linear, for a line',
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
    rows: rowsConfigSchema,
    /**
     * #slot rowColor
     * The colour a reader set on a named subtrack, as `domain`/`range` pairs:
     * its plot, or under a score gradient the tint beside its label, ahead of
     * the adapter's colour and the palette.
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
     * One CSS colour, or a field through a scale — `score` through
     * `threshold` for the bicolor plot, through `linear` for the density
     * ramp, `source` through `categorical` for a palette entry per
     * subtrack. Unset, the layout decides: several sources in one plot box
     * take a palette entry each, and anything else is the pos/neg pair about
     * the `origin`.
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
     * `domainMax`, `autoscale`, `numStdDev`, `numQuantile`, `symlogConstant`
     * and `rules`, the reference lines drawn across it. The density rendering
     * draws no rule and does not widen to one: it spends colour on the score
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
    ...summaryScoreModeConfigSchemaFields({ defaultMode: 'whiskers' }),
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
      ...retiredAxisSpellings,
      defaultRendering: rendering =>
        markOf(String(rendering)) ?? { mark: rendering },
    },
    preProcessSnapshot: checkRowsField('LinearWiggleDisplay'),
  },
)

export default linearWiggleDisplayConfigSchema

export type LinearWiggleDisplayConfigSchema =
  typeof linearWiggleDisplayConfigSchema
