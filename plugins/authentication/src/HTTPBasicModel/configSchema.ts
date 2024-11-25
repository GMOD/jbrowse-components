import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { BaseInternetAccountConfig } from '@jbrowse/core/pluggableElementTypes/models'
import type { Instance } from 'mobx-state-tree'

/**
 * #config HTTPBasicInternetAccount
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const HTTPBasicConfigSchema = ConfigurationSchema(
  'HTTPBasicInternetAccount',
  {
    /**
     * #slot
     */
    tokenType: {
      description: 'a custom name for a token to include in the header',
      type: 'string',
      defaultValue: 'Basic',
    },
    /**
     * #slot
     */
    validateWithHEAD: {
      description: 'validate the token with a HEAD request before using it',
      type: 'boolean',
      defaultValue: true,
    },
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: BaseInternetAccountConfig,
    explicitlyTyped: true,
  },
)

export type HTTPBasicInternetAccountConfigModel = typeof HTTPBasicConfigSchema

export type HTTPBasicInternetAccountConfig =
  Instance<HTTPBasicInternetAccountConfigModel>
export default HTTPBasicConfigSchema
