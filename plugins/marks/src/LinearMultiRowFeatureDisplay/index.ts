import { DisplayType } from '@jbrowse/core/pluggableElementTypes'

import { ReactComponent } from '../LinearMarkDisplay/index.ts'
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
    plot: '{"marks":[{"mark":{"type":"rect","height":{"band":0}}},{"mark":"rect","transform":[{"type":"flatten","keepEmpty":true}]}]}',
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
      displayName: 'Multi-row feature display (painting)',
      helpText:
        'Paints interval features as colored blocks on stacked rows, one row per value of a feature attribute: chromosome or ancestry painting.',
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
