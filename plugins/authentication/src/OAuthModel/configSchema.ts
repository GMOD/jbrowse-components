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
    authEndpoint: {
      defaultValue: '',
      description: 'the authorization code endpoint of the internet account',
      type: 'string',
    },

    /**
     * #slot
     */
    clientId: {
      defaultValue: '',
      description: 'id for the OAuth application',
      type: 'string',
    },

    /**
     * #slot
     */
    needsPKCE: {
      defaultValue: false,
      description: 'boolean to indicate if the endpoint needs a PKCE code',
      type: 'boolean',
    },

    /**
     * #slot
     */
    responseType: {
      defaultValue: 'code',
      description:
        "the type of response from the authorization endpoint. can be 'token' or 'code'",
      type: 'string',
    },

    /**
     * #slot
     */
    scopes: {
      defaultValue: '',
      description: 'optional scopes for the authorization call',
      type: 'string',
    },

    /**
     * #slot
     */
    state: {
      defaultValue: '',
      description: 'optional state for the authorization call',
      type: 'string',
    },

    /**
     * #slot
     */
    tokenEndpoint: {
      defaultValue: '',
      description: 'the token endpoint of the internet account',
      type: 'string',
    },

    /**
     * #slot
     */
    tokenType: {
      defaultValue: 'Bearer',
      description: 'a custom name for a token to include in the header',
      type: 'string',
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
