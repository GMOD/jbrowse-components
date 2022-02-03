import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { Instance } from 'mobx-state-tree'
import { BaseInternetAccountConfig } from '@jbrowse/core/pluggableElementTypes/models'

const ExternalTokenConfigSchema = ConfigurationSchema(
  'ExternalTokenInternetAccount',
  {},
  {
    baseConfiguration: BaseInternetAccountConfig,
    explicitlyTyped: true,
  },
)

export type ExternalTokenInternetAccountConfigModel =
  typeof ExternalTokenConfigSchema

export type ExternalTokenInternetAccountConfig =
  Instance<ExternalTokenInternetAccountConfigModel>
export default ExternalTokenConfigSchema
