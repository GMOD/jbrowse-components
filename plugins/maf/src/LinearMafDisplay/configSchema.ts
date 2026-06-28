import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'

export default function configSchemaF(pluginManager: PluginManager) {
  const LinearGenomePlugin = pluginManager.getPlugin(
    'LinearGenomeViewPlugin',
  ) as LinearGenomeViewPlugin
  const { baseLinearDisplayConfigSchema } = LinearGenomePlugin.exports
  return ConfigurationSchema(
    'LinearMafDisplay',
    {
      /**
       * #slot
       * Optional feature adapter (e.g. a BigBedAdapter over a UCSC
       * `multiz<N>wayFrames.bb`) whose CDS reading-frame rows are drawn as a
       * per-species annotation overlay — each `mafFrames` row keyed by its
       * `src` species, colored by reading `frame`. `null` disables the overlay.
       */
      annotationAdapter: {
        type: 'frozen',
        defaultValue: null,
      },
    },
    {
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}

export type LinearMafDisplayConfigModel = ReturnType<typeof configSchemaF>
export type LinearMafDisplayConfig = Instance<LinearMafDisplayConfigModel>
