import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { BaseInternetAccountConfig } from '@jbrowse/core/pluggableElementTypes/models'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config OAuthInternetAccount
 * Signs requests to a resource that uses OAuth 2.0, fetching and refreshing
 * the access token through the provider's authorization flow.
 *
 * #example
 * Any OAuth 2.0 provider, with its endpoints supplied. Register the JBrowse
 * page's URL as a redirect URI with the provider, and use `needsPKCE`, since a
 * static app has nowhere to keep a client secret.
 * ```js
 * {
 *   type: 'OAuthInternetAccount',
 *   internetAccountId: 'myOAuth',
 *   name: 'Institutional login',
 *   domains: ['data.myinstitution.org'],
 *   clientId: 'your-client-id',
 *   authEndpoint: 'https://auth.myinstitution.org/oauth/authorize',
 *   tokenEndpoint: 'https://auth.myinstitution.org/oauth/token',
 *   needsPKCE: true,
 * }
 * ```
 */

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
    responseType: {
      description:
        "the type of response from the authorization endpoint. can be 'token' or 'code'",
      type: 'string',
      defaultValue: 'code',
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
