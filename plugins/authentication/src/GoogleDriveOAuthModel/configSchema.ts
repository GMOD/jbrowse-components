import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { Instance } from 'mobx-state-tree'
import OAuthConfigSchema from '../OAuthModel/configSchema'

const GoogleDriveOAuthConfigSchema = ConfigurationSchema(
  'GoogleDriveOAuthInternetAccount',
  {
    authEndpoint: {
      description: 'the authorization code endpoint of the internet account',
      type: 'string',
      defaultValue: 'https://accounts.google.com/o/oauth2/v2/auth',
    },
    scopes: {
      description: 'optional scopes for the authorization call',
      type: 'string',
      defaultValue: 'https://www.googleapis.com/auth/drive.readonly',
    },
    domains: {
      description:
        'array of valid domains the url can contain to use this account',
      type: 'stringArray',
      defaultValue: ['drive.google.com"'],
    },
    responseType: {
      description: 'the type of response from the authorization endpoint',
      type: 'string',
      defaultValue: 'token',
    },
  },
  { baseConfiguration: OAuthConfigSchema, explicitlyTyped: true },
)

export type GoogleDriveOAuthInternetAccountConfigModel =
  typeof GoogleDriveOAuthConfigSchema

export type GoogleDriveOAuthInternetAccountConfig =
  Instance<GoogleDriveOAuthInternetAccountConfigModel>
export default GoogleDriveOAuthConfigSchema
