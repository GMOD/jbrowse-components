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
        type: 'string',
        defaultValue: '',
      },
      tokenEndpoint: {
        description: 'the token endpoint of the internet account',
        type: 'string',
        defaultValue: '',
      },
      needsAuthorization: {
        description: 'boolean to indicate if the endpoint needs authorization',
        type: 'boolean',
        defaultValue: false,
      },
      needsPKCE: {
        description: 'boolean to indicate if the endpoint needs a PKCE code',
        type: 'boolean',
        defaultValue: false,
      },
      clientId: {
        description: 'id for the OAuth application',
        type: 'string',
        defaultValue: '',
      },
      scopes: {
        description: 'optional scopes for the authorization call',
        type: 'string',
        defaultValue: '',
      },
      responseType: {
        description: 'the type of response from the authorization endpoint',
        type: 'string',
        defaultValue: 'code',
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
