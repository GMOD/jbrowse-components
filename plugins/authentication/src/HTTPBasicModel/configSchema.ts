import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { Instance } from 'mobx-state-tree'
import { BaseInternetAccountConfig } from '@jbrowse/core/pluggableElementTypes/models'

const HTTPBasicConfigSchema = ConfigurationSchema(
  'HTTPBasicInternetAccount',
  {
    tokenType: {
      description: 'a custom name for a token to include in the header',
      type: 'string',
      defaultValue: 'Basic',
    },
    validateWithHEAD: {
      description: 'validate the token with a HEAD request before using it',
      type: 'boolean',
      defaultValue: true,
    },
  },
  {
    baseConfiguration: BaseInternetAccountConfig,
    explicitlyTyped: true,
  },
)

export type HTTPBasicInternetAccountConfigModel = typeof HTTPBasicConfigSchema

export type HTTPBasicInternetAccountConfig =
  Instance<HTTPBasicInternetAccountConfigModel>
export default HTTPBasicConfigSchema
