import { ConfigurationSchema } from '@jbrowse/core/configuration'
/**
 * #config FromConfigRegionsAdapter
 * used for specifying refNames+sizes of an assembly
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const regionsConfigSchema = ConfigurationSchema(
  'FromConfigRegionsAdapter',
  {
    /**
     * #slot
     */
    features: {
      type: 'frozen',
      defaultValue: null,
    },
  },
  {
    explicitlyTyped: true,
  },
)
export default regionsConfigSchema
