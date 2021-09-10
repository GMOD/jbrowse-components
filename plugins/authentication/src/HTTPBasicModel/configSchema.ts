import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { Instance } from 'mobx-state-tree'
import { BaseInternetAccountConfig } from '@jbrowse/core/pluggableElementTypes/models'

const HTTPBasicConfigSchema = ConfigurationSchema(
  'HTTPBasicInternetAccount',
  {
    authHeader: {
      description: 'custom auth header for authorization',
      type: 'string',
      defaultValue: 'Authorization',
    },
    validDomains: {
      description:
        'array of valid domains the url can contain to use this account. Empty = all domains',
      type: 'stringArray',
      defaultValue: [],
    },
  },
  {
    baseConfiguration: BaseInternetAccountConfig,
    explicitlyTyped: true,
  },
)

export type HTTPBasicInternetAccountConfigModel = typeof HTTPBasicConfigSchema

export type HTTPBasicInternetAccountConfig = Instance<HTTPBasicInternetAccountConfigModel>
export default HTTPBasicConfigSchema
