import { ConfigurationSchema } from '@jbrowse/core/configuration'
/**
 * #config FromConfigRegionsAdapter
 * used for specifying refNames+sizes of an assembly
 */

const regionsConfigSchema = ConfigurationSchema(
  'FromConfigRegionsAdapter',
  {
    /**
     * #slot
     */
    adapterId: {
      type: 'string',
      defaultValue: '',
    },
    /**
     * #slot
     */
    features: {
      type: 'frozen',
      defaultValue: [],
    },
  },
  {
    explicitlyTyped: true,
  },
)
export default regionsConfigSchema
