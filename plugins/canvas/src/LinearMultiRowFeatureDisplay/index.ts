import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import { lazyWithPreload } from '@jbrowse/core/util/lazyWithPreload'

import configSchemaFactory from './configSchema.ts'
import { routeRetiredShorthandF } from './retiredSettings.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const LinearMultiRowFeatureDisplayComponent = lazyWithPreload(
  () => import('./components/LinearMultiRowFeatureDisplayComponent.tsx'),
)

export default function register(pluginManager: PluginManager) {
  routeRetiredShorthandF(pluginManager)
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory()
    return new DisplayType({
      name: 'LinearMultiRowFeatureDisplay',
      displayName: 'Multi-row feature display (painting)',
      helpText:
        'Paints interval features as colored blocks on stacked rows, partitioned by a feature attribute — chromosome / ancestry painting.',
      configSchema,
      stateModel: () => import('./model.ts').then(f => f.default(configSchema)),
      trackType: 'FeatureTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: LinearMultiRowFeatureDisplayComponent,
    })
  })
}
