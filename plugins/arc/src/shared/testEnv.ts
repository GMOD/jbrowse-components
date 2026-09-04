import { createDisplayTestEnvironment } from '@jbrowse/display-test-utils'
import { linearGenomeViewStateModelFactory } from '@jbrowse/plugin-linear-genome-view'

import { configSchemaFactory } from '../LinearArcDisplay/configSchema.ts'
import { stateModelFactory } from '../LinearArcDisplay/model.ts'
import { configSchemaFactory as pairedConfigSchemaFactory } from '../LinearPairedArcDisplay/configSchema.ts'
import { stateModelFactory as pairedStateModelFactory } from '../LinearPairedArcDisplay/model.ts'
import { addArcJexlFunctions } from '../index.ts'

import type { LinearArcDisplayModel } from '../LinearArcDisplay/model.ts'
import type { LinearPairedArcDisplayModel } from '../LinearPairedArcDisplay/model.ts'

// The shared display harness wired for the arc display. Arc is the one LGV
// display class with no rendering backend — it paints a Canvas2D of its own —
// so what these tests exercise is its fetch model and display phase, both of
// which need a real attach.
//
// `addArcJexlFunctions` is what lets a test omit `displayConfig` and get the
// shipped slot defaults. Without it the bare PluginManager knows none of the
// plugin's functions, so every suite here passed a literal `thickness: 2` and
// the default `jexl:logThickness(feature,'score')` — NaN on a feature with no
// score, which culls every arc off screen — was never once evaluated.
export function createTestEnvironment(displayConfig?: Record<string, unknown>) {
  const env = createDisplayTestEnvironment<LinearArcDisplayModel>({
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
  addArcJexlFunctions(env.pluginManager)
  return env
}

// The same harness for the paired display, whose arcs connect a feature to its
// mate breakend rather than spanning its own start–end.
export function createPairedTestEnvironment(
  displayConfig?: Record<string, unknown>,
) {
  const env = createDisplayTestEnvironment<LinearPairedArcDisplayModel>({
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
  addArcJexlFunctions(env.pluginManager)
  return env
}
