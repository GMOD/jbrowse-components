import { createDisplayTestEnvironment } from '@jbrowse/display-test-utils'
import { linearGenomeViewStateModelFactory } from '@jbrowse/plugin-linear-genome-view'

import { configSchemaFactory } from '../LinearArcDisplay/configSchema.ts'
import { stateModelFactory } from '../LinearArcDisplay/model.ts'

import type { LinearArcDisplayModel } from '../LinearArcDisplay/model.ts'

// The shared display harness wired for the arc display. Arc is the one LGV
// display class with no rendering backend — it paints JSX `<path>` elements —
// so what these tests exercise is its fetch model and display phase, both of
// which need a real attach.
export function createTestEnvironment() {
  return createDisplayTestEnvironment<LinearArcDisplayModel>({
    trackType: 'FeatureTrack',
    displayName: 'LinearArcDisplay',
    configSchema: () => configSchemaFactory(),
    stateModel: (_pm, schema) => stateModelFactory(schema),
    viewModel: linearGenomeViewStateModelFactory,
    assemblyEnd: 10_000_000,
    // arc is byte-gated, and the measurement rides in the fetch: `ArcGetFeatures`
    // answers the features plus what the index quoted for them
    rpcCall: (_sessionId, method) =>
      method === 'ArcGetFeatures' ? { features: [], bytes: 100 } : [],
  })
}
