import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { BaseInternetAccountConfig } from '@jbrowse/core/pluggableElementTypes/models'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config HTTPBasicInternetAccount
 *
 * #example
 * An entry in the config's `internetAccounts`. JBrowse prompts for the username
 * and password the first time a file under one of `domains` is opened, and
 * sends them as an `Authorization: Basic …` header from then on.
 * ```js
 * {
 *   type: 'HTTPBasicInternetAccount',
 *   internetAccountId: 'myLabServer',
 *   name: 'My lab server',
 *   description: 'Sequencing data behind the lab htaccess',
 *   domains: ['data.mylab.org'],
 * }
 * ```
 */

const HTTPBasicConfigSchema = ConfigurationSchema(
  'HTTPBasicInternetAccount',
  {
    /**
     * #slot
     */
    tokenType: {
      description: 'a custom name for a token to include in the header',
      type: 'string',
      defaultValue: 'Basic',
    },
    /**
     * #slot
     */
    validateWithHEAD: {
      description: 'validate the token with a HEAD request before using it',
      type: 'boolean',
      defaultValue: true,
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

export type HTTPBasicInternetAccountConfigModel = typeof HTTPBasicConfigSchema

export type HTTPBasicInternetAccountConfig =
  Instance<HTTPBasicInternetAccountConfigModel>
export default HTTPBasicConfigSchema
