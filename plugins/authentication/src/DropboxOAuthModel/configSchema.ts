import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { Instance } from 'mobx-state-tree'
import { BaseInternetAccountConfig } from '@jbrowse/core/pluggableElementTypes/models'

const DropboxOAuthConfigSchema = ConfigurationSchema(
  'DropboxOAuthInternetAccount',
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
    domains: {
      description:
        'array of valid domains the url can contain to use this account',
      type: 'stringArray',
      defaultValue: [],
    },
    responseType: {
      description: 'the type of response from the authorization endpoint',
      type: 'string',
      defaultValue: 'code',
    },
    hasRefreshToken: {
      description: 'true if the endpoint can supply a refresh token',
      type: 'boolean',
      defaultValue: false,
    },
  },
  {
    baseConfiguration: BaseInternetAccountConfig,
    explicitlyTyped: true,
  },
)

export type DropboxOAuthInternetAccountConfigModel =
  typeof DropboxOAuthConfigSchema

export type DropboxOAuthInternetAccountConfig =
  Instance<DropboxOAuthInternetAccountConfigModel>
export default DropboxOAuthConfigSchema
