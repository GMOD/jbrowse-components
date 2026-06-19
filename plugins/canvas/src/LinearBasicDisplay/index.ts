import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import { addDisplayConfigMigration } from '@jbrowse/core/pluggableElementTypes/models'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'

import configSchemaFactory from './configSchema.ts'
import { migrateBasicConfigSnapshot } from './migrateBasicSnapshot.ts'
import modelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function register(pluginManager: PluginManager) {
  // geneGlyphMode "longest" and a boolean showLabels are legacy values on
  // existing enum slots, so normalize them before the display union validates
  // the snapshot (a config-schema preProcessSnapshot does not run there).
  // Matches the alias too, since this fires before alias normalization.
  addDisplayConfigMigration(
    pluginManager,
    ['LinearBasicDisplay', 'LinearFeatureDisplay'],
    migrateBasicConfigSnapshot,
  )
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    return new DisplayType({
      name: 'LinearBasicDisplay',
      displayName: 'Feature display',
      helpText:
        'GPU-accelerated feature display with smooth zoom/pan. Data is uploaded once to GPU, enabling instant navigation.',
      configSchema,
      stateModel: modelFactory(configSchema),
      trackType: 'FeatureTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: BaseLinearDisplayComponent,
      aliases: ['LinearFeatureDisplay'],
    })
  })
}

export { default as linearBasicDisplayStateModelFactory } from './model.ts'
export { default as linearBasicDisplayConfigSchemaFactory } from './configSchema.ts'
export { default as linearCanvasBaseDisplayStateModelFactory } from './baseModel.ts'
export { default as linearCanvasBaseDisplayConfigSchemaFactory } from './baseConfigSchema.ts'
export type { LinearBasicDisplayModel } from './model.ts'
