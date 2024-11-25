import { ConfigurationSchema } from '@jbrowse/core/configuration'
import OAuthConfigSchema from '../OAuthModel/configSchema'
import type { Instance } from 'mobx-state-tree'

/**
 * #config GoogleDriveOAuthInternetAccount
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const GoogleDriveOAuthConfigSchema = ConfigurationSchema(
  'GoogleDriveOAuthInternetAccount',
  {
    /**
     * #slot
     */
    authEndpoint: {
      description: 'the authorization code endpoint of the internet account',
      type: 'string',
      defaultValue: 'https://accounts.google.com/o/oauth2/v2/auth',
    },
    /**
     * #slot
     */
    scopes: {
      description: 'optional scopes for the authorization call',
      type: 'string',
      defaultValue: 'https://www.googleapis.com/auth/drive.readonly',
    },
    /**
     * #slot
     */
    domains: {
      description:
        'array of valid domains the url can contain to use this account',
      type: 'stringArray',
      defaultValue: ['drive.google.com"'],
    },
    /**
     * #slot
     */
    responseType: {
      description: 'the type of response from the authorization endpoint',
      type: 'string',
      defaultValue: 'token',
    },
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: OAuthConfigSchema,
    explicitlyTyped: true,
  },
)

export type GoogleDriveOAuthInternetAccountConfigModel =
  typeof GoogleDriveOAuthConfigSchema

export type GoogleDriveOAuthInternetAccountConfig =
  Instance<GoogleDriveOAuthInternetAccountConfigModel>
export default GoogleDriveOAuthConfigSchema
