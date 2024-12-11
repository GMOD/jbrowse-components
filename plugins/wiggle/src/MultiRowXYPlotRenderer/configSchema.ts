import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

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
    filled: {
      type: 'boolean',
      defaultValue: true,
    },
    /**
     * #slot
     */
    displayCrossHatches: {
      type: 'boolean',
      description: 'choose to draw cross hatches (sideways lines)',
      defaultValue: false,
    },
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
    /**
     * #slot
     */
    minSize: {
      type: 'number',
      defaultValue: 0.7,
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
