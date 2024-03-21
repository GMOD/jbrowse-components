import { ConfigurationSchema } from '../../configuration'

/**
 * #config BaseInternetAccount
 * the "base" internet account type
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export const BaseInternetAccountConfig = ConfigurationSchema(
  'InternetAccount',
  {
    /**
     * #slot
     */
    authHeader: {
      defaultValue: 'Authorization',
      description: 'request header for credentials',
      type: 'string',
    },

    /**
     * #slot
     */
    description: {
      defaultValue: '',
      description: 'a description of the internet account',
      type: 'string',
    },

    /**
     * #slot
     */
    domains: {
      defaultValue: [],
      description:
        'array of valid domains the url can contain to use this account',
      type: 'stringArray',
    },

    /**
     * #slot
     */
    name: {
      defaultValue: '',
      description: 'descriptive name of the internet account',
      type: 'string',
    },

    /**
     * #slot
     */
    tokenType: {
      defaultValue: '',
      description: 'a custom name for a token to include in the header',
      type: 'string',
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
