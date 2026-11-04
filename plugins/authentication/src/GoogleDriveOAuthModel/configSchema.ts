import { ConfigurationSchema } from '@jbrowse/core/configuration'

import OAuthConfigSchema from '../OAuthModel/configSchema.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config GoogleDriveOAuthInternetAccount
 * Signs requests for Google Drive files with an OAuth 2.0 token, with the
 * Google endpoints, read-only Drive scope and domain filled in.
 *
 * #example
 * The Google endpoints are pre-filled. With the Picker's `apiKey` and `appId`
 * set, the `drive.file` scope reads the files a user picks and needs no
 * restricted-scope review from Google; see the authentication guide.
 * ```js
 * {
 *   type: 'GoogleDriveOAuthInternetAccount',
 *   internetAccountId: 'googleDriveOAuth',
 *   name: 'Google Drive',
 *   clientId: 'your-client-id.apps.googleusercontent.com',
 *   scopes: 'https://www.googleapis.com/auth/drive.file',
 *   apiKey: 'your-browser-api-key',
 *   appId: 'your-cloud-project-number',
 * }
 * ```
 */

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
      defaultValue: ['drive.google.com'],
    },
    /**
     * #slot
     */
    responseType: {
      description: 'the type of response from the authorization endpoint',
      type: 'string',
      defaultValue: 'token',
    },
    /**
     * #slot
     * Browser API key of the Cloud project that owns `clientId`, with the
     * Google Picker API enabled. Set it with `appId` to offer a "Browse Google
     * Drive" button, which lets the account work with the non-restricted
     * `https://www.googleapis.com/auth/drive.file` scope
     */
    apiKey: {
      description: 'API key for the Google Picker',
      type: 'string',
      defaultValue: '',
    },
    /**
     * #slot
     * The Cloud project number, which ties a picked file's `drive.file` grant
     * to this app
     */
    appId: {
      description: 'Cloud project number for the Google Picker',
      type: 'string',
      defaultValue: '',
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
