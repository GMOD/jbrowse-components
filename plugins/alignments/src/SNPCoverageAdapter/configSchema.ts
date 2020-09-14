import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { types } from 'mobx-state-tree'

export default (pluginManager: PluginManager) =>
  types.late(() =>
    ConfigurationSchema(
      'SNPCoverageAdapter',
      {
        subadapter: pluginManager.pluggableConfigSchemaType('adapter'),
      },
      { explicitlyTyped: true },
    ),
  )
