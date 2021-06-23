import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types, Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import { createInternetAccountConfig } from '@jbrowse/core/pluggableElementTypes/models'
import { boolean } from 'mobx-state-tree/dist/internal'

function OAuthConfigFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'OAuthInternetAccount',
    {
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
      needsAuthentication: {
        description: 'boolean to indicate if the endpoint needs authorization',
        type: 'boolean',
        defaultValue: true,
      },
      clientID: {
        description: 'id for the OAuth application',
        type: 'stringArray',
        defaultValue: [],
      },
    },
    {
      baseConfiguration: createInternetAccountConfig(pluginManager),
      explicitlyTyped: true,
    },
  )
}

export type OAuthInternetAccountConfigModel = ReturnType<
  typeof OAuthConfigFactory
>
export type OAuthInternetAccountConfig = Instance<
  OAuthInternetAccountConfigModel
>
export default OAuthConfigFactory
