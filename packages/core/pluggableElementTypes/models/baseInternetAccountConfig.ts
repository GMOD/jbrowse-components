import { ConfigurationSchema } from '../../configuration'
import { Instance } from 'mobx-state-tree'

export const BaseInternetAccountConfig = ConfigurationSchema(
  'InternetAccount',
  {
    name: {
      description: 'descriptive name of the internet acount',
      type: 'string',
      defaultValue: '',
    },
    description: {
      description: 'a description of the internet account',
      type: 'string',
      defaultValue: '',
    },
  },
  { explicitIdentifier: 'internetAccountId', explicitlyTyped: true },
)

export type BaseInternetAccountConfigModel = typeof BaseInternetAccountConfig
export type BaseInternetAccountConfig = Instance<BaseInternetAccountConfigModel>
