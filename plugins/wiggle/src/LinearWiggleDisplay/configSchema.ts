import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { wiggleConfigSchemaFields } from '../shared/wiggleConfigSchemaFields.ts'
import { WIGGLE_POS_COLOR_DEFAULT, WIGGLE_RENDERING_TYPES } from '../util.ts'

/**
 * #config LinearWiggleDisplay
 * #category display
 * configuration for the wiggle (quantitative/numeric) display showing XY plot, density, line, or scatter renderings
 *
 * These are display-level slots: set them inside a track's `displays` array to
 * change its defaults (setting them at the track top level has no effect).
 *
 * ```json
 * {
 *   "type": "QuantitativeTrack",
 *   "trackId": "my_wiggle_track",
 *   "name": "My Wiggle Track",
 *   "assemblyNames": ["hg19"],
 *   "adapter": { "type": "BigWigAdapter", "uri": "http://yourhost/file.bw" },
 *   "displays": [
 *     {
 *       "type": "LinearWiggleDisplay",
 *       "scaleType": "log",
 *       "autoscale": "global"
 *     }
 *   ]
 * }
 * ```
 */
export default ConfigurationSchema(
  'LinearWiggleDisplay',
  {
    /**
     * #slot
     */
    defaultRendering: {
      type: 'stringEnum',
      model: types.enumeration('Rendering type', [...WIGGLE_RENDERING_TYPES]),
      defaultValue: 'xyplot',
      description: 'Default rendering type',
    },
    /**
     * #slot
     */
    height: {
      type: 'number',
      defaultValue: 100,
      description: 'Default height of the track',
    },
    /**
     * #slot
     */
    useBicolor: {
      type: 'boolean',
      defaultValue: true,
      description:
        'Use separate positive/negative colors instead of a single color',
    },
    /**
     * #slot
     */
    color: {
      type: 'color',
      defaultValue: WIGGLE_POS_COLOR_DEFAULT,
      description: 'Color for the wiggle bars (when not using bicolor mode)',
    },
    ...wiggleConfigSchemaFields,
    /**
     * #slot
     */
    summaryScoreMode: {
      type: 'stringEnum',
      model: types.enumeration('Score type', ['max', 'min', 'avg', 'whiskers']),
      description:
        'choose whether to use max/min/average or whiskers which combines all three into the same rendering',
      defaultValue: 'whiskers',
    },
  },
  { explicitlyTyped: true, explicitIdentifier: 'displayId' },
)
