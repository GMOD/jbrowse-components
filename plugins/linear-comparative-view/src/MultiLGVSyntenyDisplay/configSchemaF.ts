import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

import type PluginManager from '@jbrowse/core/PluginManager'

function configSchemaF(_pluginManager: PluginManager) {
  return ConfigurationSchema(
    'MultiLGVSyntenyDisplay',
    {
      rowHeight: {
        type: 'number',
        defaultValue: 20,
        description: 'Height of each genome comparison row in pixels',
      },
      maxRows: {
        type: 'number',
        defaultValue: 50,
        description: 'Maximum number of genome rows to display',
      },
    },
    {
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}

export default configSchemaF
