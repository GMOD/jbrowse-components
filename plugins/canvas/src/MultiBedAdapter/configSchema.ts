import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config MultiBedAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const MultiBedAdapter = ConfigurationSchema(
  'MultiBedAdapter',
  {
    /**
     * #slot
     */
    subadapters: {
      type: 'frozen',
      defaultValue: [],
      description: 'array of subadapter JSON objects',
    },
  },
  { explicitlyTyped: true },
)

export default MultiBedAdapter
