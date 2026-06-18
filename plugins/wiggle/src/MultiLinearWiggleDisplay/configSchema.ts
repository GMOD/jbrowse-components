import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { wiggleConfigSchemaFields } from '../shared/wiggleConfigSchemaFields.ts'
import { MULTI_WIGGLE_RENDERING_TYPES } from '../util.ts'

// Configs are sometimes hand-authored (or copy-pasted from a single-source
// wiggle track) with a single-source rendering name even though this display
// only draws multi-source renderings. Map each to its closest multi-source
// equivalent rather than throwing an opaque MST union error.
const SINGLE_TO_MULTI_RENDERING: Record<string, string> = {
  xyplot: 'multixyplot',
  density: 'multirowdensity',
  line: 'multiline',
  scatter: 'multiscatter',
}

/**
 * #config MultiLinearWiggleDisplay
 * #category display
 * configuration for the multi-wiggle display, which draws several quantitative
 * subtracks (e.g. BigWig files) on a shared Y axis
 *
 * These are display-level slots: set them inside a track's `displays` array to
 * change its defaults (setting them at the track top level has no effect).
 *
 * ```json
 * {
 *   "type": "MultiQuantitativeTrack",
 *   "trackId": "my_multiwig_track",
 *   "name": "My MultiWig Track",
 *   "assemblyNames": ["hg19"],
 *   "adapter": { "type": "MultiWiggleAdapter", "subadapters": [] },
 *   "displays": [
 *     {
 *       "type": "MultiLinearWiggleDisplay",
 *       "defaultRendering": "multirowxy",
 *       "autoscale": "globalsd"
 *     }
 *   ]
 * }
 * ```
 */
export default ConfigurationSchema(
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
    /**
     * #slot
     */
    summaryScoreMode: {
      type: 'stringEnum',
      model: types.enumeration('Score type', ['max', 'min', 'avg', 'whiskers']),
      description:
        'choose whether to use max/min/average or whiskers which combines all three into the same rendering',
      defaultValue: 'avg',
    },
    /**
     * #slot
     * Default rendering type. Multi-row modes (`multirowxy`, `multirowdensity`,
     * `multirowline`, `multirowscatter`) draw one stacked plot per subtrack;
     * overlapping modes (`multixyplot`, `multiline`, `multiscatter`) draw all
     * subtracks together in one shared plot.
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
  },
  {
    explicitlyTyped: true,
    explicitIdentifier: 'displayId',
    preProcessSnapshot: (snap: Record<string, unknown>) => {
      const { defaultRendering, ...rest } = snap
      const remapped =
        typeof defaultRendering === 'string'
          ? SINGLE_TO_MULTI_RENDERING[defaultRendering]
          : undefined
      return remapped
        ? { ...rest, defaultRendering: remapped }
        : snap
    },
  },
)
