/* eslint-disable @typescript-eslint/no-explicit-any */
import { types, Instance } from 'mobx-state-tree'
import { ConfigurationSchema } from '../../configuration'
import PluginManager from '../../PluginManager'

export function createInternetAccountConfig(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'InternetAccount',
    {
      name: {
        description: 'descriptive name of the internet acount',
        type: 'string',
        defaultValue: 'OAuth',
      },
      description: {
        description: 'a description of the internet account',
        type: 'string',
        defaultValue: '',
      },
      metadata: {
        type: 'frozen',
        description: 'anything to add about this internet account',
        defaultValue: {},
      },
    },
    { explicitIdentifier: 'internetAccountId' },
  )
}

export type InternetAccountConfigModel = ReturnType<
  typeof createInternetAccountConfig
>
export type InternetAccountConfig = Instance<InternetAccountConfigModel>
