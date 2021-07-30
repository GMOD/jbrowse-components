import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import { createInternetAccountConfig } from '@jbrowse/core/pluggableElementTypes/models'

function HTTPBasicConfigFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'HTTPBasicInternetAccount',
    {
      authHeader: {
        description: 'custom auth header for authorization',
        type: 'string',
        defaultValue: 'Authorization',
      },
      validDomains: {
        description:
          'array of valid domains the url can contain to use this account. Empty = all domains',
        type: 'stringArray',
        defaultValue: [],
      },
    },
    {
      baseConfiguration: createInternetAccountConfig(pluginManager),
      explicitlyTyped: true,
    },
  )
}

export type HTTPBasicInternetAccountConfigModel = ReturnType<
  typeof HTTPBasicConfigFactory
>
export type HTTPBasicInternetAccountConfig = Instance<
  HTTPBasicInternetAccountConfigModel
>
export default HTTPBasicConfigFactory
