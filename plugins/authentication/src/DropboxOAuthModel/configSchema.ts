import { ConfigurationSchema } from '@jbrowse/core/configuration'

import OAuthConfigSchema from '../OAuthModel/configSchema.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config DropboxOAuthInternetAccount
 *
 * #example
 * The Dropbox endpoints are pre-filled, so an entry needs only your own OAuth
 * app's `clientId`. Leave `domains` off and the account is still selectable by
 * hand in the Add Track form.
 * ```js
 * {
 *   type: 'DropboxOAuthInternetAccount',
 *   internetAccountId: 'dropboxOAuth',
 *   name: 'Dropbox',
 *   clientId: 'your-dropbox-app-key',
 * }
 * ```
 */

const DropboxOAuthConfigSchema = ConfigurationSchema(
  'DropboxOAuthInternetAccount',
  {
    /**
     * #slot
     */
    authEndpoint: {
      description: 'the authorization code endpoint of the internet account',
      type: 'string',
      defaultValue: 'https://www.dropbox.com/oauth2/authorize',
    },
    /**
     * #slot
     */
    tokenEndpoint: {
      description: 'the token endpoint of the internet account',
      type: 'string',
      defaultValue: 'https://api.dropbox.com/oauth2/token',
    },
    /**
     * #slot
     */
    needsPKCE: {
      description: 'boolean to indicate if the endpoint needs a PKCE code',
      type: 'boolean',
      defaultValue: true,
    },
    /**
     * #slot
     */
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
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: OAuthConfigSchema,
    explicitlyTyped: true,
  },
)

export type DropboxOAuthInternetAccountConfigModel =
  typeof DropboxOAuthConfigSchema

export type DropboxOAuthInternetAccountConfig =
  Instance<DropboxOAuthInternetAccountConfigModel>
export default DropboxOAuthConfigSchema
