import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'

export default function configSchemaF(pluginManager: PluginManager) {
  const LinearGenomePlugin = pluginManager.getPlugin(
    'LinearGenomeViewPlugin',
  ) as LinearGenomeViewPlugin
  const { baseLinearDisplayConfigSchema } = LinearGenomePlugin.exports
  // No display-specific slots: the CDS-frame annotation source is a sub-adapter
  // on the MAF *adapter* (`annotationAdapter`, alongside `summaryAdapter`), not
  // the display. The display only carries the show/hide toggles.
  return ConfigurationSchema(
    'LinearMafDisplay',
    {},
    {
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}

export type LinearMafDisplayConfigModel = ReturnType<typeof configSchemaF>
export type LinearMafDisplayConfig = Instance<LinearMafDisplayConfigModel>
