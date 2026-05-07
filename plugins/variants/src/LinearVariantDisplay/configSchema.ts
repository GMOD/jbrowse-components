import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { linearCanvasBaseDisplayConfigSchemaFactory } from '@jbrowse/plugin-canvas'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config LinearVariantDisplay
 *
 * Extends LinearCanvasBaseDisplay for GPU-accelerated variant rendering.
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export default function configSchemaF(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearVariantDisplay',
    {},
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration:
        linearCanvasBaseDisplayConfigSchemaFactory(pluginManager),
      explicitlyTyped: true,
    },
  )
}

export type LinearVariantDisplayConfigModel = ReturnType<typeof configSchemaF>
export type LinearVariantDisplayConfig =
  Instance<LinearVariantDisplayConfigModel>
