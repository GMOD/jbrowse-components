import { createDisplayTestEnvironment } from '@jbrowse/display-test-utils'
import LinearGenomeViewPlugin, {
  linearGenomeViewStateModelFactory,
} from '@jbrowse/plugin-linear-genome-view'
import WigglePlugin from '@jbrowse/plugin-wiggle'

import { REGION } from '../LinearMarkDisplay/testEnv.ts'
import { configSchemaFactory } from './configSchema.ts'
import { stateModelFactory } from './model.ts'

import type { LinearMultiRowFeatureDisplayModel } from './model.ts'

export function createTestEnvironment(displayConfig: Record<string, unknown>) {
  return createDisplayTestEnvironment<LinearMultiRowFeatureDisplayModel>({
    plugins: [new LinearGenomeViewPlugin(), new WigglePlugin()],
    trackType: 'FeatureTrack',
    adapter: { name: 'BedAdapter', config: { type: 'BedAdapter' } },
    displayName: 'LinearMultiRowFeatureDisplay',
    configSchema: () => configSchemaFactory(),
    stateModel: (pm, schema) => stateModelFactory(pm, schema),
    viewModel: linearGenomeViewStateModelFactory,
    displayConfig,
    regions: [REGION],
    assemblyRegions: [REGION],
    onViewReady: view => {
      view.showAllRegions()
    },
  })
}
