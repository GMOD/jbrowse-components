import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import configSchemaF from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearVariantDisplayF(pluginManager: PluginManager) {
  // Registered only when the canvas plugin is installed: this display's model
  // extends the canvas base and borrows `LinearBasicDisplay`'s registered
  // component below, so without that plugin there is nothing to render through
  // and `getDisplayType` would throw out of `createPluggableElements`. Embedded
  // products legitimately ship variants without the linear stack —
  // jbrowse-react-circular-genome-view installs it for the chord display alone —
  // so skipping is the answer, not pulling canvas into their bundle.
  if (pluginManager.hasPlugin('CanvasPlugin')) {
    pluginManager.addDisplayType(() => {
      const configSchema = configSchemaF(pluginManager)
      // Borrow the registered component rather than import one across the plugin
      // boundary (the same move LGVSyntenyDisplay makes with
      // LinearAlignmentsDisplay). The variant-specific chrome rides along on the
      // base's model hooks: its color key comes from `colorLegend`, and it simply
      // doesn't answer the gene-glyph hook. Resolved inside this factory
      // callback, which runs after every plugin is installed.
      const { ReactComponent } =
        pluginManager.getDisplayType('LinearBasicDisplay')
      return new DisplayType({
        name: 'LinearVariantDisplay',
        displayName: 'Variant display',
        helpText:
          'GPU-accelerated variant display with smooth zoom/pan. Data is uploaded once to GPU, enabling instant navigation.',
        configSchema,
        // lazily loaded: the model composes the canvas base display model, so a
        // static edge here would pull that whole subgraph into the eager bundle
        stateModel: () =>
          import('./model.ts').then(f => f.default(configSchema)),
        trackType: 'VariantTrack',
        viewType: 'LinearGenomeView',
        ReactComponent,
      })
    })
  }
}
