import { DisplayType } from '@jbrowse/core/pluggableElementTypes'

import { ReactComponent } from '../LinearMarkDisplay/index.ts'
import { SPLICED_PLOT_EXAMPLE } from '../LinearMarkDisplay/markPlot.ts'
import { configSchemaFactory } from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { PlotExample } from '@jbrowse/core/configuration'

/** What "Edit plot..." offers as buttons on a multi-row feature track. */
export const MULTI_ROW_PLOT_EXAMPLES: PlotExample[] = [
  {
    plot: '{ "encoding": { "color": "strand" } }',
    description: 'forward strand red, reverse blue',
  },
  {
    plot: '{ "facet": "group" }',
    description: 'one band per row group',
  },
  {
    plot: '{ "encoding": { "color": { "value": "#1f77b4" } } }',
    description: 'one color for everything',
  },
  {
    plot: SPLICED_PLOT_EXAMPLE,
    description: "each feature's blocks joined by a line",
  },
]

export default function LinearMultiRowFeatureDisplayF(
  pluginManager: PluginManager,
) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory()
    return new DisplayType({
      name: 'LinearMultiRowFeatureDisplay',
      displayName: 'Feature rows by attribute',
      helpText:
        'One row per value of a feature attribute, such as repeat class, sample or cell type, with each feature a colored block: repeat classes, chromatin states, copy number, chromosome and ancestry paintings.',
      configSchema,
      stateModel: () =>
        import('./model.ts').then(f =>
          f.stateModelFactory(pluginManager, configSchema),
        ),
      trackType: 'FeatureTrack',
      viewType: 'LinearGenomeView',
      plotExamples: MULTI_ROW_PLOT_EXAMPLES,
      ReactComponent,
    })
  })
}
