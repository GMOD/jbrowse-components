import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { Instance } from 'mobx-state-tree'
import { BaseInternetAccountConfig } from '@jbrowse/core/pluggableElementTypes/models'

/**
 * !config
 */
const ExternalTokenConfigSchema = ConfigurationSchema(
  'ExternalTokenInternetAccount',
  {
    /**
     * !slot
     */
    validateWithHEAD: {
      description: 'validate the token with a HEAD request before using it',
      type: 'boolean',
      defaultValue: true,
    },
  },
  {
    /**
     * !baseConfiguration
     */
    baseConfiguration: BaseInternetAccountConfig,
    explicitlyTyped: true,
  },
)

export type ExternalTokenInternetAccountConfigModel =
  typeof ExternalTokenConfigSchema

export type ExternalTokenInternetAccountConfig =
  Instance<ExternalTokenInternetAccountConfigModel>
export default ExternalTokenConfigSchema
