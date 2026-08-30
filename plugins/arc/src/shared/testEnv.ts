import { createDisplayTestEnvironment } from '@jbrowse/display-test-utils'
import { linearGenomeViewStateModelFactory } from '@jbrowse/plugin-linear-genome-view'

import { configSchemaFactory } from '../LinearArcDisplay/configSchema.ts'
import { stateModelFactory } from '../LinearArcDisplay/model.ts'
import { configSchemaFactory as pairedConfigSchemaFactory } from '../LinearPairedArcDisplay/configSchema.ts'
import { stateModelFactory as pairedStateModelFactory } from '../LinearPairedArcDisplay/model.ts'

import type { LinearArcDisplayModel } from '../LinearArcDisplay/model.ts'
import type { LinearPairedArcDisplayModel } from '../LinearPairedArcDisplay/model.ts'

// The shared display harness wired for the arc display. Arc is the one LGV
// display class with no rendering backend — it paints a Canvas2D of its own —
// so what these tests exercise is its fetch model and display phase, both of
// which need a real attach.
// `displayConfig` for the style slots: their defaults are jexl calls into
// functions the plugin's `install` registers, and the harness builds a bare
// PluginManager, so a test that renders arcs (rather than driving the fetch
// model) has to supply plain values.
export function createTestEnvironment(displayConfig?: Record<string, unknown>) {
  return createDisplayTestEnvironment<LinearArcDisplayModel>({
    trackType: 'FeatureTrack',
    displayName: 'LinearArcDisplay',
    displayConfig,
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

// The same harness for the paired display, whose arcs connect a feature to its
// mate breakend rather than spanning its own start–end.
export function createPairedTestEnvironment(
  displayConfig?: Record<string, unknown>,
) {
  return createDisplayTestEnvironment<LinearPairedArcDisplayModel>({
    trackType: 'VariantTrack',
    displayName: 'LinearPairedArcDisplay',
    displayConfig,
    configSchema: () => pairedConfigSchemaFactory(),
    stateModel: (_pm, schema) => pairedStateModelFactory(schema),
    viewModel: linearGenomeViewStateModelFactory,
    assemblyEnd: 10_000_000,
    rpcCall: (_sessionId, method) =>
      method === 'ArcGetFeatures' ? { features: [], bytes: 100 } : [],
  })
}
