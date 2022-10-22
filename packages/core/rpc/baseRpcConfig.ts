import { ConfigurationSchema } from '../configuration'

/**
 * #config BaseRpcDriver
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const BaseRpcDriverConfigSchema = ConfigurationSchema(
  'BaseRpcDriver',
  {
    /**
     * #slot
     */
    workerCount: {
      type: 'number',
      description:
        'The number of workers to use. If 0 (the default) JBrowse will decide how many workers to use.',
      defaultValue: 0,
    },
  },
  { explicitlyTyped: true },
)
export default BaseRpcDriverConfigSchema
