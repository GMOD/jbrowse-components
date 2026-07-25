import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import configSchemaF from './configSchema.ts'
import stateModelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearVariantDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF(pluginManager)
    // This display's model extends the canvas base, so it draws through the
    // canvas body too — borrow that display's registered component rather than
    // import a component across the plugin boundary (the same move
    // LGVSyntenyDisplay makes with LinearAlignmentsDisplay). The variant-specific
    // chrome rides along on the base's model hooks: its color key comes from
    // `colorLegend`, and it simply doesn't answer the gene-glyph hook. Resolved
    // inside this factory callback, which runs after every plugin is installed.
    const { ReactComponent } =
      pluginManager.getDisplayType('LinearBasicDisplay')
    return new DisplayType({
      name: 'LinearVariantDisplay',
      displayName: 'Variant display',
      helpText:
        'GPU-accelerated variant display with smooth zoom/pan. Data is uploaded once to GPU, enabling instant navigation.',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'VariantTrack',
      viewType: 'LinearGenomeView',
      ReactComponent,
    })
  })
}
