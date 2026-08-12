import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { BaseInternetAccountConfig } from '@jbrowse/core/pluggableElementTypes/models'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config ExternalTokenInternetAccount
 *
 * #example
 * For a token the user pastes in, or that an embedding portal hands over.
 * JBrowse does not obtain the token itself — it prompts for one, then sends it
 * on every request to a matching domain.
 * ```js
 * {
 *   type: 'ExternalTokenInternetAccount',
 *   internetAccountId: 'portalToken',
 *   name: 'Data portal token',
 *   domains: ['api.myportal.org'],
 * }
 * ```
 */

const ExternalTokenConfigSchema = ConfigurationSchema(
  'ExternalTokenInternetAccount',
  {
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

export type ExternalTokenInternetAccountConfigModel =
  typeof ExternalTokenConfigSchema

export type ExternalTokenInternetAccountConfig =
  Instance<ExternalTokenInternetAccountConfigModel>
export default ExternalTokenConfigSchema
