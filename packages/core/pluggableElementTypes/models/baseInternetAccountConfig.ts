/* eslint-disable @typescript-eslint/no-explicit-any */
import { Instance } from 'mobx-state-tree'
import { ConfigurationSchema } from '../../configuration'
import PluginManager from '../../PluginManager'

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
      authHeader: {
        description:
          'the auth header to use during fetch, defaults to Authorization if not provided',
        type: 'string',
        defaultValue: 'Authorization',
      },
      origin: {
        description: 'origin of the auth account',
        type: 'string',
        defaultValue: '',
      },
      tokenType: {
        description: 'the token type to be prepended in the auth header',
        type: 'string',
        defaultValue: '',
      },
      //   metadata: {
      //     type: 'frozen',
      //     description: 'anything to add about this internet account',
      //     defaultValue: {},
      //   },
    },
    { explicitIdentifier: 'internetAccountId' },
  )
}

export type InternetAccountConfigModel = ReturnType<
  typeof createInternetAccountConfig
>
export type InternetAccountConfig = Instance<InternetAccountConfigModel>
