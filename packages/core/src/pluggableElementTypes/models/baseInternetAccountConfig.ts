import { ConfigurationSchema } from '../../configuration/index.ts'

/**
 * #config BaseInternetAccount
 * Holds an internet account's name and description, the domains it handles,
 * and the request header it sends credentials in. Every internet account type
 * has these slots.
 */

export const BaseInternetAccountConfig = ConfigurationSchema(
  'InternetAccount',
  {
    /**
     * #slot
     */
    name: {
      description: 'descriptive name of the internet account',
      type: 'string',
      defaultValue: '',
    },
    /**
     * #slot
     */
    description: {
      description: 'a description of the internet account',
      type: 'string',
      defaultValue: '',
    },
    /**
     * #slot
     */
    authHeader: {
      description: 'request header for credentials',
      type: 'string',
      defaultValue: 'Authorization',
    },
    /**
     * #slot
     */
    tokenType: {
      description: 'a custom name for a token to include in the header',
      type: 'string',
      defaultValue: '',
    },
    /**
     * #slot
     */
    domains: {
      description:
        'array of valid domains the url can contain to use this account',
      type: 'stringArray',
      defaultValue: [],
    },
  },
  {
    /**
     * #identifier
     */
    explicitIdentifier: 'internetAccountId',
    explicitlyTyped: true,
  },
)
