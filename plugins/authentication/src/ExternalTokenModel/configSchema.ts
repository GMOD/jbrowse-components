import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { BaseInternetAccountConfig } from '@jbrowse/core/pluggableElementTypes/models'
import type { Instance } from 'mobx-state-tree'

/**
 * #config ExternalTokenInternetAccount
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const ExternalTokenConfigSchema = ConfigurationSchema(
  'ExternalTokenInternetAccount',
  {
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

export type ExternalTokenInternetAccountConfigModel =
  typeof ExternalTokenConfigSchema

export type ExternalTokenInternetAccountConfig =
  Instance<ExternalTokenInternetAccountConfigModel>
export default ExternalTokenConfigSchema
