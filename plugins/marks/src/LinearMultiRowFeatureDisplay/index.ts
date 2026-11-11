import { DisplayType } from '@jbrowse/core/pluggableElementTypes'
import { lazyWithPreload } from '@jbrowse/core/util/lazyWithPreload'

import { configSchemaFactory } from './configSchema.ts'
import { MULTI_ROW_PLOT_EXAMPLES } from './plotExamples.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const ReactComponent = lazyWithPreload(
  () => import('./components/LinearMultiRowFeatureDisplayComponent.tsx'),
)

export default function LinearMultiRowFeatureDisplayF(
  pluginManager: PluginManager,
) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory()
    return new DisplayType({
      name: 'LinearMultiRowFeatureDisplay',
      displayName: 'Multi-row display',
      helpText:
        "Each feature a block in its file's own color, one row per value of the attribute One row per... picks, such as sample, cell type or repeat class: chromatin states, copy number, chromosome and ancestry paintings.",
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
