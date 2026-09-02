import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { regionTooLargeConfigSchemaFields } from '@jbrowse/display-kit/regionTooLargeConfigSchemaFields'
import { types } from '@jbrowse/mobx-state-tree'
import {
  rowSeparatorsConfigSchemaFields,
  treeSidebarConfigSchemaFields,
} from '@jbrowse/tree-sidebar'

import { remapRetiredAutoscale } from '../shared/remapRetiredAutoscale.ts'
import { summaryScoreModeConfigSchemaFields } from '../shared/summaryScoreModeConfigSchemaFields.ts'
import { wiggleConfigSchemaFields } from '../shared/wiggleConfigSchemaFields.ts'
import { MULTI_WIGGLE_RENDERING_TYPES } from '../util.ts'

// Configs are sometimes hand-authored (or copy-pasted from a single-source
// wiggle track) with a single-source rendering name even though this display
// only draws multi-source renderings. Map each to its closest multi-source
// equivalent rather than throwing an opaque MST union error. Every value in
// WIGGLE_RENDERING_TYPES needs an entry — a missing one is an MST validation
// error at config load, not a silent fallback (see configSchema.test.ts).
const SINGLE_TO_MULTI_RENDERING: Record<string, string> = {
  xyplot: 'multixyplot',
  density: 'multirowdensity',
  line: 'multiline',
  linecenter: 'multilinecenter',
  scatter: 'multiscatter',
}

// Rewrites a single-source `defaultRendering` to its multi-source equivalent on
// a MultiLinearWiggleDisplay snapshot. Shared by this schema's
// preProcessSnapshot and the Core-preProcessTrackConfig handler — the latter is
// needed because preProcessSnapshot does NOT run while a types.union validates
// the display snapshot (union dispatch checks the raw snapshot).
export function remapMultiWiggleRendering(snap: Record<string, unknown>) {
  const { defaultRendering } = snap
  const remapped =
    typeof defaultRendering === 'string'
      ? SINGLE_TO_MULTI_RENDERING[defaultRendering]
      : undefined
  return remapped ? { ...snap, defaultRendering: remapped } : snap
}

// Both legacy remaps a MultiLinearWiggleDisplay snapshot needs before the
// types.union validates it: single-source rendering names and retired autoscale
// values.
function remapMultiWiggleConfig(snap: Record<string, unknown>) {
  return remapRetiredAutoscale(remapMultiWiggleRendering(snap))
}

/**
 * #config MultiLinearWiggleDisplay
 * #category display
 * configuration for the multi-wiggle display, which draws several quantitative
 * subtracks (e.g. BigWig files) on a shared Y axis
 *
 * These are display-level slots: set them inside a track's `displays` to
 * change its defaults (setting them at the track top level has no effect).
 * The object shorthand `displayDefaults: { key: value }` is equivalent to the
 * full `displays: [{ type: 'MultiLinearWiggleDisplay', displayId: '...', key: value }]`
 * array form — see
 * [configuring displays](/docs/config_guides/tracks#configuring-displays).
 *
 * Per-subtrack metadata (a `name`, `color`, and `group` for each subtrack) is
 * preloaded on the *adapter*, not here — use `MultiWiggleAdapter`'s
 * `subadapters` slot, where `group` drives the sidebar clustering tree and
 * `color` sets each subtrack's line/fill.
 *
 * #example
 * Minimal `MultiQuantitativeTrack` config. See the
 * [multi-quantitative track guide](/docs/config_guides/multiquantitative_track)
 * for all adapter and display options:
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
 * Taller track overlaying two samples in one shared plot (`multixyplot`)
 * instead of the default stacked-per-subtrack layout:
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
 *   displayDefaults: { height: 300, defaultRendering: 'multixyplot' },
 * }
 * ```
 */
const configSchema = ConfigurationSchema(
  'MultiLinearWiggleDisplay',
  {
    ...wiggleConfigSchemaFields,
    /**
     * #slot
     */
    height: {
      type: 'number',
      defaultValue: 200,
      description: 'Default height of the track',
    },
    ...summaryScoreModeConfigSchemaFields({ defaultMode: 'avg' }),
    /**
     * #slot
     * Default rendering type. Multi-row modes (`multirowxy`, `multirowdensity`,
     * `multirowline`, `multirowlinecenter`, `multirowscatter`) draw one stacked
     * plot per subtrack; overlapping modes (`multixyplot`, `multiline`,
     * `multilinecenter`, `multiscatter`) draw all subtracks together in one
     * shared plot.
     * #example
     * ```json
     * {
     *   "type": "MultiLinearWiggleDisplay",
     *   "defaultRendering": "multixyplot"
     * }
     * ```
     */
    defaultRendering: {
      type: 'stringEnum',
      model: types.enumeration('Rendering', [...MULTI_WIGGLE_RENDERING_TYPES]),
      defaultValue: 'multirowxy',
      description: 'Default rendering type',
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
    ...treeSidebarConfigSchemaFields({
      tree: 'Show the subtrack clustering tree in the sidebar',
      rowLabels: 'Name each subtrack row down the left edge',
    }),
    ...rowSeparatorsConfigSchemaFields(),
    /**
     * #slot
     */
    showLegend: {
      type: 'maybeBoolean',
      description:
        'Draw the source color key in overlay mode. Unset (the default) follows the session-wide default for this display type, falling back to on; an explicit true/false customizes the track',
      // Promotable: `undefined` (unset) is the inherit state, `promotedBase`
      // (true) is what it resolves to when nothing is promoted. Read through the
      // resolved `showLegend` getter (resolveConf), never raw.
      promotedBase: true,
    },
    // Owed to `RegionTooLargeMixin`, which this display composes through
    // `MultiRegionDisplayMixin` and which reads both slots through a host cast.
    // Same reason as the single-source wiggle schema: neither extends
    // `baseLinearDisplayConfigSchema`, so the pair comes from the mixin's own
    // table.
    ...regionTooLargeConfigSchemaFields,
  },
  {
    explicitlyTyped: true,
    explicitIdentifier: 'displayId',
    // NOTE: this only fires on a direct schema create. The display config is
    // normally reached through a types.union (a track's `displays` array), and
    // union dispatch validates the RAW snapshot without running
    // preProcessSnapshot — so the same remap is also registered as a
    // Core-preProcessTrackConfig handler (see ./preProcessTrackConfig.ts).
    preProcessSnapshot: (snap: Record<string, unknown>) =>
      remapMultiWiggleConfig(snap),
  },
)

export default configSchema

export type MultiLinearWiggleDisplayConfigModel = typeof configSchema
