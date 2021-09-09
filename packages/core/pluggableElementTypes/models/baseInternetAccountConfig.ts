import { Instance } from 'mobx-state-tree'
import { ConfigurationSchema } from '../../configuration'
import PluginManager from '../../PluginManager'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createInternetAccountConfig(pluginManager: PluginManager) {
  return ConfigurationSchema(
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
}

export type InternetAccountConfigModel = ReturnType<
  typeof createInternetAccountConfig
>
export type InternetAccountConfig = Instance<InternetAccountConfigModel>
