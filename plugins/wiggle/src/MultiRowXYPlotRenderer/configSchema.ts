import { types } from 'mobx-state-tree'

import { ConfigurationSchema } from '@jbrowse/core/configuration'
import baseWiggleRendererConfigSchema from '../configSchema'

/**
 * #config MultiRowXYPlotRenderer
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const configSchema = ConfigurationSchema(
  'MultiRowXYPlotRenderer',
  {
    /**
     * #slot
     */
    displayCrossHatches: {
      defaultValue: false,
      description: 'choose to draw cross hatches (sideways lines)',
      type: 'boolean',
    },

    /**
     * #slot
     */
    filled: {
      defaultValue: true,
      type: 'boolean',
    },

    /**
     * #slot
     */
    minSize: {
      defaultValue: 0,
      type: 'number',
    },

    /**
     * #slot
     */
    summaryScoreMode: {
      defaultValue: 'whiskers',
      description:
        'choose whether to use max/min/average or whiskers which combines all three into the same rendering',
      model: types.enumeration('Score type', ['max', 'min', 'avg', 'whiskers']),
      type: 'stringEnum',
    },
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: baseWiggleRendererConfigSchema,
    explicitlyTyped: true,
  },
)

export default configSchema
