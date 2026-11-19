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
