import { ConfigurationSchema } from '../../configuration'
import { Instance } from 'mobx-state-tree'

export const BaseInternetAccountConfig = ConfigurationSchema(
  'InternetAccount',
  {
    name: {
      description: 'descriptive name of the internet account',
      type: 'string',
      defaultValue: '',
    },
    description: {
      description: 'a description of the internet account',
      type: 'string',
      defaultValue: '',
    },
    authHeader: {
      description: 'request header for credentials',
      type: 'string',
      defaultValue: 'Authorization',
    },
    tokenType: {
      description: 'a custom name for a token to include in the header',
      type: 'string',
      defaultValue: '',
    },
    domains: {
      description:
        'array of valid domains the url can contain to use this account',
      type: 'stringArray',
      defaultValue: [],
    },
  },
  { explicitIdentifier: 'internetAccountId', explicitlyTyped: true },
)

export type BaseInternetAccountConfigModel = typeof BaseInternetAccountConfig
export type BaseInternetAccountConfig = Instance<BaseInternetAccountConfigModel>
