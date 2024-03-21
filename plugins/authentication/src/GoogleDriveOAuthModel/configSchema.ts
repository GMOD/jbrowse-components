import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { Instance } from 'mobx-state-tree'
import OAuthConfigSchema from '../OAuthModel/configSchema'

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
      defaultValue: 'https://accounts.google.com/o/oauth2/v2/auth',
      description: 'the authorization code endpoint of the internet account',
      type: 'string',
    },

    /**
     * #slot
     */
    domains: {
      defaultValue: ['drive.google.com"'],
      description:
        'array of valid domains the url can contain to use this account',
      type: 'stringArray',
    },

    /**
     * #slot
     */
    responseType: {
      defaultValue: 'token',
      description: 'the type of response from the authorization endpoint',
      type: 'string',
    },

    /**
     * #slot
     */
    scopes: {
      defaultValue: 'https://www.googleapis.com/auth/drive.readonly',
      description: 'optional scopes for the authorization call',
      type: 'string',
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
