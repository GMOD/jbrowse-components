import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'
import baseWiggleRendererConfigSchema from '../configSchema'
/**
 * #config MultiLineRenderer
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const configSchema = ConfigurationSchema(
  'MultiLineRenderer',
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
    summaryScoreMode: {
      defaultValue: 'avg',
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
