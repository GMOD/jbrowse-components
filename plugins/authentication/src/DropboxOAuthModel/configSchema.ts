import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { Instance } from 'mobx-state-tree'
import OAuthConfigSchema from '../OAuthModel/configSchema'

const DropboxOAuthConfigSchema = ConfigurationSchema(
  'DropboxOAuthInternetAccount',
  {
    authEndpoint: {
      description: 'the authorization code endpoint of the internet account',
      type: 'string',
      defaultValue: 'https://www.dropbox.com/oauth2/authorize',
    },
    tokenEndpoint: {
      description: 'the token endpoint of the internet account',
      type: 'string',
      defaultValue: 'https://api.dropbox.com/oauth2/token',
    },
    needsPKCE: {
      description: 'boolean to indicate if the endpoint needs a PKCE code',
      type: 'boolean',
      defaultValue: true,
    },
    domains: {
      description:
        'array of valid domains the url can contain to use this account',
      type: 'stringArray',
      defaultValue: [
        'addtodropbox.com',
        'db.tt',
        'dropbox.com',
        'dropboxapi.com',
        'dropboxbusiness.com',
        'dropbox.tech',
        'getdropbox.com',
      ],
    },
    hasRefreshToken: {
      description: 'true if the endpoint can supply a refresh token',
      type: 'boolean',
      defaultValue: true,
    },
  },
  { baseConfiguration: OAuthConfigSchema, explicitlyTyped: true },
)

export type DropboxOAuthInternetAccountConfigModel =
  typeof DropboxOAuthConfigSchema

export type DropboxOAuthInternetAccountConfig =
  Instance<DropboxOAuthInternetAccountConfigModel>
export default DropboxOAuthConfigSchema
