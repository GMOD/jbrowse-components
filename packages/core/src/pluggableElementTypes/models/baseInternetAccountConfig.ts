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
