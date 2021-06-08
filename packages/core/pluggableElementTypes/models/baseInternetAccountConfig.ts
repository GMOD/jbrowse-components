/* eslint-disable @typescript-eslint/no-explicit-any */
import { types, Instance } from 'mobx-state-tree'
import { ConfigurationSchema } from '../../configuration'
import PluginManager from '../../PluginManager'

export function createInternetAccountConfig(pluginManager: PluginManager) {
  return ConfigurationSchema('InternetAccount', {
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
    authEndpoint: {
      description: 'the authorization code endpoint of the internet account',
      type: 'stringArray',
      defaultValue: [],
    },
    tokenEndpoint: {
      description: 'the token endpoint of the internet account',
      type: 'stringArray',
      defaultValue: [],
    },
    metadata: {
      type: 'frozen',
      description: 'anything to add about this internet account',
      defaultValue: {},
    },
  })
}

export type InternetAccountConfigModel = ReturnType<
  typeof createInternetAccountConfig
>
export type InternetAccountConfig = Instance<InternetAccountConfigModel>
