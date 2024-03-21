import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { Instance } from 'mobx-state-tree'
import OAuthConfigSchema from '../OAuthModel/configSchema'

/**
 * #config DropboxOAuthInternetAccount
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const DropboxOAuthConfigSchema = ConfigurationSchema(
  'DropboxOAuthInternetAccount',
  {
    /**
     * #slot
     */
    authEndpoint: {
      defaultValue: 'https://www.dropbox.com/oauth2/authorize',
      description: 'the authorization code endpoint of the internet account',
      type: 'string',
    },

    /**
     * #slot
     */
    domains: {
      defaultValue: [
        'addtodropbox.com',
        'db.tt',
        'dropbox.com',
        'dropboxapi.com',
        'dropboxbusiness.com',
        'dropbox.tech',
        'getdropbox.com',
      ],
      description:
        'array of valid domains the url can contain to use this account',
      type: 'stringArray',
    },

    /**
     * #slot
     */
    needsPKCE: {
      defaultValue: true,
      description: 'boolean to indicate if the endpoint needs a PKCE code',
      type: 'boolean',
    },

    /**
     * #slot
     */
    tokenEndpoint: {
      defaultValue: 'https://api.dropbox.com/oauth2/token',
      description: 'the token endpoint of the internet account',
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

export type DropboxOAuthInternetAccountConfigModel =
  typeof DropboxOAuthConfigSchema

export type DropboxOAuthInternetAccountConfig =
  Instance<DropboxOAuthInternetAccountConfigModel>
export default DropboxOAuthConfigSchema
