import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { Instance } from 'mobx-state-tree'
import { BaseInternetAccountConfig } from '@jbrowse/core/pluggableElementTypes/models'

/**
 * #config OAuthInternetAccount
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const OAuthConfigSchema = ConfigurationSchema(
  'OAuthInternetAccount',
  {
    /**
     * #slot
     */
    tokenType: {
      description: 'a custom name for a token to include in the header',
      type: 'string',
      defaultValue: 'Bearer',
    },
    /**
     * #slot
     */
    authEndpoint: {
      description: 'the authorization code endpoint of the internet account',
      type: 'string',
      defaultValue: '',
    },
    /**
     * #slot
     */
    tokenEndpoint: {
      description: 'the token endpoint of the internet account',
      type: 'string',
      defaultValue: '',
    },
    /**
     * #slot
     */
    needsPKCE: {
      description: 'boolean to indicate if the endpoint needs a PKCE code',
      type: 'boolean',
      defaultValue: false,
    },
    /**
     * #slot
     */
    clientId: {
      description: 'id for the OAuth application',
      type: 'string',
      defaultValue: '',
    },
    /**
     * #slot
     */
    scopes: {
      description: 'optional scopes for the authorization call',
      type: 'string',
      defaultValue: '',
    },
    /**
     * #slot
     */
    state: {
      description: 'optional state for the authorization call',
      type: 'string',
      defaultValue: '',
    },
    /**
     * #slot
     */
    responseType: {
      description: 'the type of response from the authorization endpoint',
      type: 'string',
      defaultValue: 'code',
    },
    /**
     * #slot
     */
    hasRefreshToken: {
      description: 'true if the endpoint can supply a refresh token',
      type: 'boolean',
      defaultValue: false,
    },
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: BaseInternetAccountConfig,
    explicitlyTyped: true,
  },
)

export type OAuthInternetAccountConfigModel = typeof OAuthConfigSchema
export type OAuthInternetAccountConfig =
  Instance<OAuthInternetAccountConfigModel>
export default OAuthConfigSchema
